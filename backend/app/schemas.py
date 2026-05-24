from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class UserBase(BaseModel):
    username: str
    role: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

class CompanyBase(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    hq_location: Optional[str] = None
    timezone: Optional[str] = None
    news_rss: Optional[str] = None
    careers_url: Optional[str] = None
    priority: Optional[str] = "medium"
    is_active: Optional[bool] = True

    latitude: Optional[float] = None
    longitude: Optional[float] = None
    country: Optional[str] = None
    region: Optional[str] = None
    slm_score: Optional[int] = None

class CompanyCreate(CompanyBase):
    pass

class Company(CompanyBase):
    id: int

    class Config:
        from_attributes = True

class ScrapedArticleBase(BaseModel):
    title: str
    url: str
    content: str
    source_type: str

class ScrapedArticle(ScrapedArticleBase):
    id: int
    company_id: int
    scraped_at: datetime

    class Config:
        from_attributes = True

class TriggerEventBase(BaseModel):
    event_type: str
    summary: str
    business_impact: str
    recommended_service: str
    confidence_score: float

class TriggerEvent(TriggerEventBase):
    id: int
    company_id: int
    article_id: int
    assigned_to_id: Optional[int] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class OutreachBriefBase(BaseModel):
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    contact_linkedin: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    subject: str
    body: str
    linkedin_draft: Optional[str] = None
    whatsapp_draft: Optional[str] = None
    persona: str
    recommended_send_time: Optional[datetime] = None

class OutreachBrief(OutreachBriefBase):
    id: int
    company_id: int
    trigger_id: int
    created_at: datetime

    class Config:
        from_attributes = True
