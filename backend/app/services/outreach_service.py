import json
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from app.models import TriggerEvent, Company, OutreachBrief, RelantoService
from app.config import settings
from app.services.trigger_service import call_outreach_slm, call_persona_slm
from googlesearch import search
import httpx
import time
import re
from datetime import datetime, timedelta
import pytz

logger = logging.getLogger(__name__)

def infer_persona(trigger_event: TriggerEvent) -> str:
    """
    Persona Inference using llama-3.2-3b-preview (Persona SLM).
    Simple classification task — given a trigger, return the best C-level role to contact.
    Speed is prioritized over prose quality here.
    """
    prompt = f"""You are a B2B sales strategist. A trigger event occurred at a target company.
Trigger Event Type: {trigger_event.event_type}
Trigger Summary: {trigger_event.summary}
Business Impact: {trigger_event.business_impact}

Return a JSON object with a single key "persona" containing the SINGLE best C-level or VP-level job title to contact (e.g., "VP Engineering", "CTO", "CIO", "Head of AI", "VP Marketing").
Output only valid JSON."""

    response = call_persona_slm(prompt)

    try:
        data = json.loads(response)
        return data.get("persona", "CTO")
    except Exception:
        return "CTO"

def discover_contact(company_name: str, persona: str) -> dict:
    """Uses Google Search to find a LinkedIn profile for the given persona at the company."""
    query = f'site:linkedin.com/in "{company_name}" "{persona}"'
    contact = {
        "name": None,
        "role": persona,
        "linkedin_url": None
    }
    
    try:
        # Fetch top 3 results
        results = search(query, num_results=3, sleep_interval=2)
        for url in results:
            if "linkedin.com/in/" in url:
                contact["linkedin_url"] = url
                
                # Try to extract a name from the URL (heuristic: linkedin.com/in/first-last-1234)
                # This is a fallback since we aren't using a heavy scraper
                match = re.search(r'in/([a-zA-Z0-9-]+)', url)
                if match:
                    slug = match.group(1)
                    # Clean up the slug (remove numbers and dashes)
                    name_parts = [p.capitalize() for p in slug.split('-') if p.isalpha()]
                    if name_parts:
                        contact["name"] = " ".join(name_parts[:2])
                break
    except Exception as e:
        logger.error(f"Error during Google Search discovery: {e}")
        
    if not contact["name"]:
        contact["name"] = "John Doe (Placeholder)" # Fallback for demo
        
    # Mock Phone Number for MVP WhatsApp routing
    contact["phone"] = f"+1-555-019-{len(company_name)%10}{len(persona)%10}"
        
    return contact

def enrich_contact(contact: dict, company_domain: str, company_name: str) -> str:
    """Uses Hunter.io and Apollo APIs to enrich contact email, with fallback heuristic."""
    if not company_domain:
        return None
        
    # Remove http/www and get root domain
    domain = company_domain.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
    
    name = contact.get("name", "")
    if not name or name == "John Doe (Placeholder)":
        return f"contact@{domain}"
        
    parts = name.split()
    first_name = parts[0] if len(parts) > 0 else ""
    last_name = parts[-1] if len(parts) > 1 else ""

    # 1. Try Hunter.io API
    if settings.hunter_api_key and settings.hunter_api_key != "your_hunter_api_key_here":
        try:
            url = f"https://api.hunter.io/v2/email-finder?domain={domain}&first_name={first_name}&last_name={last_name}&api_key={settings.hunter_api_key}"
            response = httpx.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                email = data.get("data", {}).get("email")
                if email:
                    logger.info(f"Found email via Hunter.io: {email}")
                    return email
        except Exception as e:
            logger.error(f"Hunter API error: {e}")

    # 2. Try Apollo.io API Fallback
    if settings.apollo_api_key and settings.apollo_api_key != "your_apollo_api_key_here":
        try:
            url = "https://api.apollo.io/api/v1/people/match"
            payload = {
                "api_key": settings.apollo_api_key,
                "first_name": first_name,
                "last_name": last_name,
                "organization_name": company_name
            }
            response = httpx.post(url, json=payload, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                person = data.get("person", {})
                email = person.get("email")
                if email:
                    logger.info(f"Found email via Apollo: {email}")
                    return email
        except Exception as e:
            logger.error(f"Apollo API error: {e}")

    # 3. Fallback Heuristic
    logger.info("Falling back to email heuristic.")
    return f"{first_name.lower()}.{last_name.lower()}@{domain}"

def generate_multi_channel_content(db: Session, trigger_event: TriggerEvent, company: Company, contact: dict) -> dict:
    """
    Outreach Content Generation using mixtral-8x7b-32768 (Outreach SLM).
    Mixtral 8x7B is chosen for its superior instruction-following and business writing quality
    — producing more natural, personalized email/LinkedIn/WhatsApp copy than smaller models.
    """
    
    # Get the recommended Relanto service details
    service = db.query(RelantoService).filter(RelantoService.name == trigger_event.recommended_service).first()
    service_desc = service.description if service else "Our advanced AI and digital transformation solutions."
    
    prompt = f"""
    You are an elite B2B sales account executive for "Relanto". You specialize in SLM (Small Language Model) personalized outreach.
    Draft a highly personalized cold email based on dynamic trigger intelligence.
    
    [Target Details]
    - Target Company: {company.name}
    - Company Industry: {company.industry or 'Technology'}
    - Contact Name: {contact.get('name', 'there')}
    - Contact Role: {contact.get('role', 'Leader')}
    
    [Dynamic Trigger Intelligence]
    - Trigger Event Detected: {trigger_event.summary}
    - Direct Business Impact / Pain Point: {trigger_event.business_impact}
    
    [Relanto Value Proposition]
    - Solution to Pitch: {trigger_event.recommended_service}
    - Solution Description: {service_desc}
    
    Rules for the email:
    1. Keep it under 150 words. Be concise and punchy.
    2. Hook them immediately by acknowledging the Trigger Event.
    3. Introduce Relanto's {trigger_event.recommended_service} as the solution.
    
    Rules for LinkedIn Draft:
    1. Maximum 300 characters. Very conversational.
    2. Direct engagement on their profile or a connection request intro.
    
    Rules for WhatsApp Draft (if contact is warm):
    1. Extremely concise (1-2 sentences).
    2. Casual but professional, designed for quick follow-ups or intro.
    
    Output format must be JSON:
    {{
        "email_subject": "The email subject line",
        "email_body": "The plain text email body",
        "linkedin_draft": "The short LinkedIn message",
        "whatsapp_draft": "The short WhatsApp message"
    }}
    """
    
    # Use Outreach SLM: mixtral-8x7b-32768 — best writing quality on Groq
    response = call_outreach_slm(prompt)
    try:
        data = json.loads(response)
        return data
    except Exception as e:
        logger.error(f"Error generating multi-channel content (mixtral-8x7b-32768): {e}")
        return {
            "email_subject": f"Thoughts on {company.name}'s recent initiatives",
            "email_body": f"Hi {contact.get('name', '')},\n\nI saw the recent news and wanted to see if Relanto could help.\n\nBest,\nRelanto Team",
            "linkedin_draft": f"Hi {contact.get('name', '')}, noticed your recent moves at {company.name}. Let's connect!",
            "whatsapp_draft": f"Hi {contact.get('name', '')}, just sent over an email regarding {company.name}'s recent updates. Talk soon!"
        }

OUTREACH_SCORE_THRESHOLD = 70  # score >= 70 = green = eligible for outreach

def compute_outreach_score(trigger: TriggerEvent, company: Company, contact: dict) -> dict:
    """
    Composite Outreach Readiness Score (0–100). Threshold = 70.

    Components:
      - Trigger Confidence  40%: SLM certainty (0.8=80pts, 0.9=90pts)
      - Company Priority    20%: High=100, Medium=55, Low=25
      - Signal Recency      20%: <7d=100, <14d=75, <30d=50, <60d=25, older=10
      - Data Completeness   20%: contact@ email=15, heuristic email=40,
                                  real name+20, role+15, linkedin+15

    With current data (0.80-0.90 confidence, high/medium/low priority):
      HIGH   + 0.80 confidence → ~78  GREEN ✓
      MEDIUM + 0.90 confidence → ~73  GREEN ✓
      MEDIUM + 0.80 confidence → ~69  RED   ✓
      LOW    + any confidence  → ~64  RED   ✓
    This gives a genuine green/red split rather than everything passing.
    """
    from datetime import timezone as dt_timezone

    # 1. Trigger confidence (0–100)
    confidence_score = round((trigger.confidence_score or 0) * 100, 1)

    # 2. Company priority — medium is deliberately below the pass line on its own
    priority_map = {"high": 100, "medium": 55, "low": 25}
    priority_score = priority_map.get((company.priority or "medium").lower(), 55)

    # 3. Signal recency (0–100)
    now = datetime.now(dt_timezone.utc)
    created = trigger.created_at
    if created and created.tzinfo is None:
        created = created.replace(tzinfo=dt_timezone.utc)
    days_old = (now - created).days if created else 99
    if days_old < 7:
        recency_score = 100
    elif days_old < 14:
        recency_score = 75
    elif days_old < 30:
        recency_score = 50
    elif days_old < 60:
        recency_score = 25
    else:
        recency_score = 10

    # 4. Data completeness (0–100)
    completeness_score = 0
    email = contact.get("email") or ""
    if email and "@" in email:
        local = email.split("@")[0]
        if local in ("contact", "info", "support", "admin", "hello", "sales"):
            completeness_score += 15   # generic mailbox — exists but low value
        elif "." in local or "_" in local:
            completeness_score += 40   # first.last pattern — heuristic but usable
        else:
            completeness_score += 25   # single-name, uncertain

    name = contact.get("name") or ""
    if name and "Placeholder" not in name:
        completeness_score += 20       # real discovered name
    if contact.get("role"):
        completeness_score += 15       # persona always inferred
    if contact.get("linkedin_url"):
        completeness_score += 15       # linkedin found
    completeness_score = min(completeness_score, 100)

    # Weighted composite
    total = round(
        confidence_score   * 0.40 +
        priority_score     * 0.20 +
        recency_score      * 0.20 +
        completeness_score * 0.20,
        1
    )

    return {
        "total": total,
        "passed": total >= OUTREACH_SCORE_THRESHOLD,
        "breakdown": {
            "confidence":   round(confidence_score, 1),
            "priority":     round(priority_score, 1),
            "recency":      round(recency_score, 1),
            "completeness": round(completeness_score, 1),
        }
    }


def calculate_optimal_send_time(timezone_str: str) -> datetime:
    """Calculate next 9:30 AM in the company's local timezone, skipping weekends."""
    try:
        tz = pytz.timezone(timezone_str)
    except Exception:
        tz = pytz.timezone("America/New_York")  # fallback

    now_local = datetime.now(tz)
    # Start from tomorrow to always give a future time
    candidate = now_local.replace(hour=9, minute=30, second=0, microsecond=0) + timedelta(days=1)

    # Skip weekends (5=Saturday, 6=Sunday)
    while candidate.weekday() >= 5:
        candidate += timedelta(days=1)

    return candidate

def send_cold_email(to_email: str, subject: str, body: str):
    """Sends the email using SMTP if configured, otherwise prints to console."""
    if not settings.smtp_user or not settings.smtp_password or settings.smtp_user == "your_email@gmail.com":
        logger.info(f"--- MOCK EMAIL SEND ---")
        logger.info(f"To: {to_email}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Body: \n{body}")
        logger.info(f"-----------------------")
        return True
        
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.sender_email
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
        server.quit()
        logger.info(f"Email successfully sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email via SMTP: {e}")
        return False

def process_outreach_pipeline(db: Session, trigger_id: int):
    """Main orchestration function for the outreach pipeline."""
    logger.info(f"Starting outreach pipeline for trigger {trigger_id}")
    
    trigger = db.query(TriggerEvent).filter(TriggerEvent.id == trigger_id).first()
    if not trigger:
        logger.error(f"Trigger {trigger_id} not found.")
        return None
        
    company = db.query(Company).filter(Company.id == trigger.company_id).first()
    if not company:
        logger.error(f"Company for trigger {trigger_id} not found.")
        return None
        
    # Check if brief already exists
    existing_brief = db.query(OutreachBrief).filter(OutreachBrief.trigger_id == trigger_id).first()
    if existing_brief:
        logger.info(f"Outreach brief already exists for trigger {trigger_id}")
        return existing_brief

    # Step 1 & 2: Infer Persona
    persona = infer_persona(trigger)
    logger.info(f"Inferred persona: {persona}")
    
    # Step 3: Discover Contact
    contact = discover_contact(company.name, persona)
    logger.info(f"Discovered contact: {contact}")
    
    # Step 4: Enrich Contact (Get Email)
    email = enrich_contact(contact, company.website, company.name)
    contact['email'] = email
    logger.info(f"Enriched email: {email}")
    
    # Step 5: Compute Outreach Readiness Score BEFORE generating content
    score_result = compute_outreach_score(trigger, company, contact)
    outreach_score = score_result["total"]
    passed_threshold = score_result["passed"]
    score_breakdown = score_result["breakdown"]
    logger.info(
        f"Outreach score for trigger {trigger_id}: {outreach_score}/100 "
        f"({'PASS' if passed_threshold else 'FAIL'}) — breakdown: {score_breakdown}"
    )

    # Step 6: Generate Omni-Channel Content
    outreach_content = generate_multi_channel_content(db, trigger, company, contact)

    # Step 7: Calculate optimal send time (9:30 AM in company's local timezone)
    company_timezone = company.timezone or "America/New_York"
    optimal_send_time = calculate_optimal_send_time(company_timezone)
    logger.info(f"Optimal send time for {company.name} ({company_timezone}): {optimal_send_time}")

    # Save to Database — always save the brief so the sales rep can see the score
    brief = OutreachBrief(
        company_id=company.id,
        trigger_id=trigger.id,
        contact_name=contact.get('name'),
        contact_role=contact.get('role'),
        contact_linkedin=contact.get('linkedin_url'),
        contact_email=contact.get('email'),
        contact_phone=contact.get('phone'),
        subject=outreach_content.get('email_subject', ''),
        body=outreach_content.get('email_body', ''),
        linkedin_draft=outreach_content.get('linkedin_draft', ''),
        whatsapp_draft=outreach_content.get('whatsapp_draft', ''),
        persona=persona,
        recommended_send_time=optimal_send_time,
        outreach_score=outreach_score,
        passed_threshold=passed_threshold,
        score_breakdown=score_breakdown,
    )

    db.add(brief)

    # Update Trigger Status
    trigger.status = "Outreach Drafted"
    db.commit()
    db.refresh(brief)

    # Step 8: Only send email if score passes threshold (green gate)
    if not passed_threshold:
        logger.warning(
            f"Outreach BLOCKED for trigger {trigger_id} — score {outreach_score}/100 "
            f"below threshold {OUTREACH_SCORE_THRESHOLD}. Brief saved as Draft for review."
        )
        return brief

    if contact.get('email'):
        send_cold_email(contact['email'], brief.subject, brief.body)
        trigger.status = "Outreach Sent"
        db.commit()

    return brief
