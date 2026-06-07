import json
import logging
import time
import random
from sqlalchemy.orm import Session
from sqlalchemy import case
from app.models import ScrapedArticle, TriggerEvent, RelantoService, Company, User
from app.config import settings
from groq import Groq
from openai import OpenAI

logger = logging.getLogger(__name__)

def call_llm(prompt: str) -> str:
    # Check if API keys are missing or invalid
    has_key = False
    if settings.llm_provider.lower() == "openai" and settings.openai_api_key and not settings.openai_api_key.startswith("your_"):
        has_key = True
    elif settings.llm_provider.lower() != "openai" and settings.groq_api_key and not settings.groq_api_key.startswith("your_"):
        has_key = True

    if not has_key:
        logger.info("No API keys found or placeholder keys used. Falling back to mock trigger detection.")
        # If it's a leadership change prompt for Evelyn Drake
        if "Evelyn Drake" in prompt or "VP of AI Strategy" in prompt:
            return json.dumps({
                "has_trigger": True,
                "event_type": "Leadership Change",
                "summary": "Dr. Evelyn Drake joins Relanto Demo Corp as VP of AI Strategy & Cloud Modernization",
                "business_impact": "Requires integration of Retrieval-Augmented Generation, Snowflake/Databricks, and deep learning scaling, requiring executive guidance on cognitive automation.",
                "recommended_service": "AI Automation",
                "confidence_score": 0.95
            })
        # If it's a hiring or general prompt
        return json.dumps({
            "has_trigger": True,
            "event_type": "Cloud Modernization",
            "summary": "Expanding enterprise cloud infrastructure and data platforms.",
            "business_impact": "Needs expert assistance in migrating legacy systems to scalable cloud architectures.",
            "recommended_service": "Cloud Modernization",
            "confidence_score": 0.85
        })

    try:
        if settings.llm_provider.lower() == "openai":
            client = OpenAI(api_key=settings.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={ "type": "json_object" }
            )
            return response.choices[0].message.content
        else:
            client = Groq(api_key=settings.groq_api_key)
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={ "type": "json_object" }
            )
            return response.choices[0].message.content
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        return "{}"

def call_persona_slm(prompt: str) -> str:
    has_key = False
    if settings.llm_provider.lower() == "openai" and settings.openai_api_key and not settings.openai_api_key.startswith("your_"):
        has_key = True
    elif settings.llm_provider.lower() != "openai" and settings.groq_api_key and not settings.groq_api_key.startswith("your_"):
        has_key = True

    if not has_key:
        logger.info("No API keys found or placeholder keys used. Falling back to mock persona inference.")
        if "Evelyn Drake" in prompt or "VP of AI Strategy" in prompt:
            return json.dumps({"persona": "VP of AI Strategy & Cloud Modernization"})
        return json.dumps({"persona": "CTO"})

    try:
        if settings.llm_provider.lower() == "openai":
            client = OpenAI(api_key=settings.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={ "type": "json_object" }
            )
            return response.choices[0].message.content
        else:
            client = Groq(api_key=settings.groq_api_key)
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={ "type": "json_object" }
            )
            return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Persona SLM Error: {e}")
        return "{}"

def call_outreach_slm(prompt: str) -> str:
    has_key = False
    if settings.llm_provider.lower() == "openai" and settings.openai_api_key and not settings.openai_api_key.startswith("your_"):
        has_key = True
    elif settings.llm_provider.lower() != "openai" and settings.groq_api_key and not settings.groq_api_key.startswith("your_"):
        has_key = True

    if not has_key:
        logger.info("No API keys found or placeholder keys used. Falling back to mock outreach generation.")
        if "Evelyn Drake" in prompt or "VP of AI Strategy" in prompt:
            return json.dumps({
                "email_subject": "Accelerating AI Strategy & Cloud Modernization at Relanto Demo Corp",
                "email_body": "Dear Dr. Evelyn Drake,\n\nCongratulations on your new role as VP of AI Strategy & Cloud Modernization at Relanto Demo Corp!\n\nI noticed that you'll be overseeing RAG paradigms, agentic multi-model orchestration, and enterprise Snowflake/Databricks cloud data integrations. Relanto specializes in scaling deep learning infrastructure and SaaS applications with our AI Automation services.\n\nI'd love to share how we have helped similar firms accelerate their cognitive automation initiatives. Do you have 10 minutes for a brief call next Tuesday at 10:00 AM?\n\nWarm regards,\nSales Team\nRelanto",
                "linkedin_draft": "Hi Dr. Drake, congrats on your new role as VP of AI Strategy & Cloud Modernization! Let's connect to discuss enterprise cognitive automation.",
                "whatsapp_draft": "Hi Dr. Drake, congrats on the new role! Just sent a quick email about Relanto's AI Automation support for Demo Corp. Let's chat."
            })
        return json.dumps({
            "email_subject": "Optimizing Cloud Infrastructure and Platforms",
            "email_body": "Hi there,\n\nI saw your recent cloud modernisation initiatives and wanted to reach out. Relanto specializes in Cloud Modernization services designed to scale your infrastructure.\n\nDo you have some time for a brief discussion next week?\n\nBest,\nSales Team\nRelanto",
            "linkedin_draft": "Hi, saw your cloud modernization initiatives. Let's connect to discuss scaling options.",
            "whatsapp_draft": "Hi, just sent an email regarding your cloud modernisation updates. Talk soon!"
        })

    try:
        if settings.llm_provider.lower() == "openai":
            client = OpenAI(api_key=settings.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={ "type": "json_object" }
            )
            return response.choices[0].message.content
        else:
            client = Groq(api_key=settings.groq_api_key)
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={ "type": "json_object" }
            )
            return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Outreach SLM Error: {e}")
        return "{}"

def analyze_article(db: Session, article: ScrapedArticle):
    # Fetch relanto services to provide context to LLM
    services = db.query(RelantoService).all()
    services_context = "\n".join([f"- {s.name}: {s.description}. Triggers: {s.associated_triggers}" for s in services])
    
    prompt = f"""
    You are an expert sales intelligence analyst. Analyze the following article content from {article.source_type} about a company.
    Determine if there is a strategic "Trigger Event". 
    Valid Trigger Events: Funding, Leadership Change, Hiring Surge, AI Adoption, Cloud Migration, Product Launch, Expansion, Acquisition, Merger, Partnership, Layoff, Data Platform Modernization.
    
    If no significant trigger event is found, return {{"has_trigger": false}}.
    
    If a trigger is found, extract the event type, summarize it, and map it to ONE of the following Relanto services:
    {services_context}
    
    Also, generate the potential business impact of this event.
    
    Article Title: {article.title}
    Article Content: {article.content[:2000]}
    
    Output strictly in JSON format:
    {{
        "has_trigger": true/false,
        "event_type": "The Trigger Type",
        "summary": "Brief summary of the event",
        "business_impact": "How this impacts their business and why they need help",
        "recommended_service": "The exact name of the Relanto Service from the list above",
        "confidence_score": 0.0 to 1.0
    }}
    """
    
    response_text = call_llm(prompt)
    
    # Get sales reps for auto-assignment
    sales_reps = db.query(User).filter(User.role == "sales_rep").all()
    
    try:
        data = json.loads(response_text)
        if data.get("has_trigger") and data.get("confidence_score", 0) > 0.6:
            # Check if trigger already exists for this article
            existing = db.query(TriggerEvent).filter(TriggerEvent.article_id == article.id).first()
            if not existing:
                assigned_to_id = random.choice(sales_reps).id if sales_reps else None
                trigger = TriggerEvent(
                    company_id=article.company_id,
                    article_id=article.id,
                    event_type=data.get("event_type"),
                    summary=data.get("summary"),
                    business_impact=data.get("business_impact"),
                    recommended_service=data.get("recommended_service"),
                    confidence_score=data.get("confidence_score"),
                    assigned_to_id=assigned_to_id,
                    status="Assigned" if assigned_to_id else "New"
                )
                db.add(trigger)
                db.commit()
                return trigger
    except json.JSONDecodeError:
        logger.error("Failed to parse LLM JSON response")
    return None

def has_strategic_keywords(text: str) -> bool:
    if not text:
        return False
    keywords = ["raise", "series", "fund", "acquir", "merg", "appoint", "ceo", "cfo", "cto", 
                "layoff", "reduc", "launch", "cloud", "ai", "artificial intelligence", "moderniz",
                "partner", "expand", "growth"]
    text_lower = text.lower()
    return any(k in text_lower for k in keywords)

def process_unprocessed_articles(db: Session):
    # Find articles that haven't been processed yet, prioritizing Demo Corp (company_id=1)
    unprocessed_articles = db.query(ScrapedArticle)\
        .filter(ScrapedArticle.is_processed == False)\
        .order_by(
            case((ScrapedArticle.company_id == 1, 0), else_=1),
            ScrapedArticle.scraped_at.desc()
        )\
        .limit(50).all()
    
    triggers_found = 0
    articles_skipped = 0
    
    for article in unprocessed_articles:
        # 1. Heuristic Pre-Filter
        if not has_strategic_keywords(article.title + " " + article.content):
            logger.info(f"Skipping article {article.id} - No strategic keywords found.")
            articles_skipped += 1
            # Mark as processed and skip LLM
            article.is_processed = True
            db.commit()
            continue
            
        # 2. Deep LLM Analysis
        existing = db.query(TriggerEvent).filter(TriggerEvent.article_id == article.id).first()
        if not existing:
            result = analyze_article(db, article)
            if result:
                triggers_found += 1
                try:
                    from app.services.outreach_service import process_outreach_pipeline
                    process_outreach_pipeline(db, result.id)
                except Exception as e:
                    logger.error(f"Failed to process outreach pipeline: {e}")
            
            # Groq free tier limit is ~30 RPM. Sleep to avoid 429 errors.
            time.sleep(2.5)
            
        # 3. Always mark as processed, even if no trigger found
        article.is_processed = True
        db.commit()
                
    return {"message": f"Processed {len(unprocessed_articles)} articles. Skipped {articles_skipped}. Found {triggers_found} new triggers."}
