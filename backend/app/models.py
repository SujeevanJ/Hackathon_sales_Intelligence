from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String) # "admin" or "sales_rep"
    is_active = Column(Boolean, default=True)

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    industry = Column(String)
    website = Column(String)
    hq_location = Column(String)
    timezone = Column(String)
    news_rss = Column(String)
    careers_url = Column(String)
    priority = Column(String)
    trigger_news_rss = Column(String, nullable=True)
    funding_news_rss = Column(String, nullable=True)
    leadership_news_rss = Column(String, nullable=True)
    hiring_news_rss = Column(String, nullable=True)
    acquisition_news_rss = Column(String, nullable=True)
    product_news_rss = Column(String, nullable=True)
    industry_news_rss = Column(String, nullable=True)
    public_sources = Column(JSON, nullable=True)
    recommended_scrape_strategy = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Map & Scoring fields
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    country = Column(String, nullable=True)
    region = Column(String, nullable=True)
    slm_score = Column(Integer, nullable=True)

    articles = relationship("ScrapedArticle", back_populates="company")
    triggers = relationship("TriggerEvent", back_populates="company")
    outreach_briefs = relationship("OutreachBrief", back_populates="company")
    monitoring_logs = relationship("MonitoringLog", back_populates="company")

class ScrapedArticle(Base):
    __tablename__ = "scraped_articles"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    title = Column(String)
    url = Column(String, unique=True)
    content = Column(Text)
    source_type = Column(String)
    is_processed = Column(Boolean, default=False)
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="articles")
    trigger = relationship("TriggerEvent", back_populates="article", uselist=False)

class TriggerEvent(Base):
    __tablename__ = "trigger_events"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    article_id = Column(Integer, ForeignKey("scraped_articles.id"))
    event_type = Column(String)
    summary = Column(Text)
    business_impact = Column(Text)
    recommended_service = Column(String)
    confidence_score = Column(Float)
    
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="New") # "New", "Assigned", "Outreach Sent", "Closed"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="triggers")
    article = relationship("ScrapedArticle", back_populates="trigger")
    assigned_to = relationship("User")
    outreach_brief = relationship("OutreachBrief", back_populates="trigger", uselist=False)

class OutreachBrief(Base):
    __tablename__ = "outreach_briefs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    trigger_id = Column(Integer, ForeignKey("trigger_events.id"))
    
    contact_name = Column(String, nullable=True)
    contact_role = Column(String, nullable=True)
    contact_linkedin = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    
    subject = Column(String)
    body = Column(Text)
    linkedin_draft = Column(Text, nullable=True)
    whatsapp_draft = Column(Text, nullable=True)
    persona = Column(String)
    recommended_send_time = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="outreach_briefs")
    trigger = relationship("TriggerEvent", back_populates="outreach_brief")

class RelantoService(Base):
    __tablename__ = "relanto_services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text)
    pain_points_solved = Column(Text)
    associated_triggers = Column(Text)

class RelantoProfile(Base):
    __tablename__ = "relanto_profile"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, default="Relanto")
    description = Column(Text)
    target_industries = Column(Text)

class MonitoringLog(Base):
    __tablename__ = "monitoring_logs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    status = Column(String)
    error_message = Column(Text, nullable=True)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="monitoring_logs")

class ChatbotAuditLog(Base):
    __tablename__ = "chatbot_audit_log"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, index=True)
    user_id = Column(String, nullable=True)
    message = Column(Text)
    detected_intent = Column(String, nullable=True)
    guardrail_action = Column(String)
    deny_reason = Column(String, nullable=True)
    api_endpoint_called = Column(String, nullable=True)
    response_tokens = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
