import logging
from datetime import datetime
from sqlalchemy.orm import Session
from typing import List, Dict

from app.models import TriggerEvent, Company, OutreachBrief, User, RelantoService
from app.config import settings
from groq import Groq
from openai import OpenAI

logger = logging.getLogger(__name__)


def _build_context(db: Session, user: User) -> str:
    services = db.query(RelantoService).all()
    services_text = "\n".join(f"  - {s.name}: {s.description}" for s in services)

    trigger_q = db.query(TriggerEvent).order_by(TriggerEvent.created_at.desc())
    if user.role == "sales_rep":
        trigger_q = trigger_q.filter(TriggerEvent.assigned_to_id == user.id)
    triggers = trigger_q.limit(20).all()
    trigger_lines = []
    for t in triggers:
        cname = t.company.name if t.company else "Unknown"
        trigger_lines.append(
            f"  - [{t.event_type}] {cname}: {t.summary} "
            f"(confidence {t.confidence_score:.0%}, service: {t.recommended_service}, status: {t.status})"
        )
    triggers_text = "\n".join(trigger_lines) if trigger_lines else "  None yet."

    companies = db.query(Company).filter(Company.is_active == True).order_by(Company.id).all()
    company_lines = [
        f"  - {c.name} | {c.industry} | {c.hq_location} | priority: {c.priority} | SLM score: {c.slm_score}"
        for c in companies
    ]
    companies_text = "\n".join(company_lines)

    outreach_q = db.query(OutreachBrief).order_by(OutreachBrief.created_at.desc())
    if user.role == "sales_rep":
        outreach_q = outreach_q.join(TriggerEvent).filter(TriggerEvent.assigned_to_id == user.id)
    outreaches = outreach_q.limit(10).all()
    outreach_lines = []
    for o in outreaches:
        cname = o.company.name if o.company else "Unknown"
        outreach_lines.append(
            f"  - {cname}: contact {o.contact_name} ({o.contact_role}), "
            f"subject: \"{o.subject}\", persona: {o.persona}"
        )
    outreaches_text = "\n".join(outreach_lines) if outreach_lines else "  None yet."

    return f"""RELANTO SERVICES:
{services_text}

RECENT TRIGGER EVENTS ({len(triggers)} shown):
{triggers_text}

MONITORED COMPANIES ({len(companies)} total):
{companies_text}

RECENT OUTREACH BRIEFS ({len(outreaches)} shown):
{outreaches_text}"""


def chat(db: Session, user: User, messages: List[Dict]) -> str:
    context = _build_context(db, user)
    today = datetime.now().strftime("%Y-%m-%d")

    system_prompt = f"""You are an AI-powered Sales Intelligence Assistant for Relanto's enterprise sales team.

Your job is to help sales representatives and managers make faster, smarter sales decisions using live platform data.

You can help with:
- Identifying which companies to prioritize for outreach and why
- Explaining trigger events and their business significance
- Recommending which Relanto service to pitch for a given trigger
- Suggesting outreach talking points, subject lines, or messaging angles
- Summarising pipeline status and activity trends
- Answering questions about specific companies or contacts

Guidelines:
- Be concise and actionable — sales teams need quick answers, not essays
- Always reference the actual platform data when it is relevant
- Connect every trigger or company insight back to Relanto's value proposition
- If asked to draft an email or message, produce a ready-to-use draft

Current user: {user.username} (role: {user.role})
Today's date: {today}

LIVE PLATFORM DATA:
{context}"""

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    try:
        if settings.llm_provider.lower() == "openai":
            client = OpenAI(api_key=settings.openai_api_key)
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=full_messages,
                temperature=0.7,
                max_tokens=1024,
            )
        else:
            client = Groq(api_key=settings.groq_api_key)
            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=full_messages,
                temperature=0.7,
                max_tokens=1024,
            )
        return resp.choices[0].message.content
    except Exception as e:
        logger.error(f"Chat LLM error: {e}")
        return "I'm having trouble reaching my AI backend right now. Please try again in a moment."
