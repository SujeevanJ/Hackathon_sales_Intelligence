import json
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from app.models import TriggerEvent, Company, OutreachBrief, RelantoService
from app.config import settings
from app.services.trigger_service import call_llm
from googlesearch import search
import httpx
import time
import re

logger = logging.getLogger(__name__)

def infer_persona(trigger_event: TriggerEvent) -> str:
    """Uses LLM to determine the best persona to contact based on the trigger."""
    prompt = f"""
    You are an expert B2B sales strategist. A trigger event has occurred at a target company.
    Trigger Event Type: {trigger_event.event_type}
    Trigger Summary: {trigger_event.summary}
    Business Impact: {trigger_event.business_impact}
    
    Based on this, what is the SINGLE best C-level or VP-level persona (role title) to contact regarding our services?
    Provide ONLY the job title (e.g., "VP Engineering", "Head of AI", "CIO", "CTO", "VP Marketing").
    """
    response = call_llm(f"{{ \"instructions\": \"{prompt}\", \"output_format\": \"return a JSON object with a single key 'persona' containing the title string.\" }}")
    
    try:
        data = json.loads(response)
        return data.get("persona", "CTO") # Fallback to CTO
    except:
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
    """Uses LLM to draft personalized Email, LinkedIn, and WhatsApp messages."""
    
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
    
    response = call_llm(prompt)
    try:
        data = json.loads(response)
        return data
    except Exception as e:
        logger.error(f"Error generating multi-channel content: {e}")
        return {
            "email_subject": f"Thoughts on {company.name}'s recent initiatives",
            "email_body": f"Hi {contact.get('name', '')},\n\nI saw the recent news and wanted to see if Relanto could help.\n\nBest,\nRelanto Team",
            "linkedin_draft": f"Hi {contact.get('name', '')}, noticed your recent moves at {company.name}. Let's connect!",
            "whatsapp_draft": f"Hi {contact.get('name', '')}, just sent over an email regarding {company.name}'s recent updates. Talk soon!"
        }

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
    
    # Step 5: Generate Omni-Channel Content
    outreach_content = generate_multi_channel_content(db, trigger, company, contact)
    
    # Save to Database
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
        persona=persona
    )
    
    db.add(brief)
    
    # Update Trigger Status
    trigger.status = "Outreach Drafted"
    
    db.commit()
    db.refresh(brief)
    
    # Step 6: Send Email (or mock print)
    if contact.get('email'):
        send_cold_email(contact['email'], brief.subject, brief.body)
        trigger.status = "Outreach Sent"
        db.commit()
        
    return brief
