"""
Shared pytest fixtures.
Uses SQLite so no real PostgreSQL connection is needed.

IMPORTANT: DATABASE_URL must be overridden before any app module is imported,
because app/main.py calls Base.metadata.create_all() at module level.
"""
import os
# Override env vars before any app import so pydantic_settings picks them up
os.environ["DATABASE_URL"] = "sqlite:///./test_sales_intel.db"
os.environ["GROQ_API_KEY"] = "test_key_not_real"
os.environ["LLM_PROVIDER"] = "groq"

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models import User, Company, ScrapedArticle, TriggerEvent, OutreachBrief, RelantoService
from app.auth import get_password_hash, create_access_token

# ── In-memory SQLite engine ───────────────────────────────────────────────────
SQLALCHEMY_TEST_URL = "sqlite:///./test_sales_intel.db"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── DB fixture ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


# ── TestClient fixture ────────────────────────────────────────────────────────
@pytest.fixture(scope="function")
def client(db):
    """FastAPI test client with DB dependency overridden to use the test DB."""
    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── User fixtures ─────────────────────────────────────────────────────────────
@pytest.fixture
def admin_user(db):
    user = User(
        username="test_admin",
        password_hash=get_password_hash("AdminPass123!"),
        role="admin",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def sales_rep_user(db):
    user = User(
        username="test_rep",
        password_hash=get_password_hash("RepPass123!"),
        role="sales_rep",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def sales_rep_user2(db):
    user = User(
        username="test_rep2",
        password_hash=get_password_hash("RepPass123!"),
        role="sales_rep",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── Token fixtures ────────────────────────────────────────────────────────────
@pytest.fixture
def admin_token(admin_user):
    return create_access_token({"sub": admin_user.username, "role": admin_user.role})


@pytest.fixture
def sales_rep_token(sales_rep_user):
    return create_access_token({"sub": sales_rep_user.username, "role": sales_rep_user.role})


# ── Data fixtures ─────────────────────────────────────────────────────────────
@pytest.fixture
def sample_company(db):
    company = Company(
        name="Acme Corp",
        industry="Technology",
        website="https://acme.com",
        hq_location="San Francisco, CA",
        timezone="America/Los_Angeles",
        priority="high",
        is_active=True,
        slm_score=85,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@pytest.fixture
def sample_company2(db):
    company = Company(
        name="Beta Ltd",
        industry="Finance",
        website="https://beta.com",
        hq_location="New York, NY",
        priority="medium",
        is_active=True,
        slm_score=60,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@pytest.fixture
def sample_article(db, sample_company):
    article = ScrapedArticle(
        company_id=sample_company.id,
        title="Acme Corp raises $50M Series B",
        url="https://techcrunch.com/acme-series-b",
        content="Acme Corp announced a $50M Series B funding round to accelerate cloud migration.",
        source_type="Google News RSS",
        is_processed=False,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@pytest.fixture
def sample_trigger(db, sample_company, sample_article, sales_rep_user):
    trigger = TriggerEvent(
        company_id=sample_company.id,
        article_id=sample_article.id,
        event_type="Funding",
        summary="Acme Corp raised $50M Series B for cloud expansion.",
        business_impact="They will accelerate infrastructure scaling and may need cloud modernization support.",
        recommended_service="Cloud Modernization",
        confidence_score=0.92,
        assigned_to_id=sales_rep_user.id,
        status="Assigned",
    )
    db.add(trigger)
    db.commit()
    db.refresh(trigger)
    return trigger


@pytest.fixture
def sample_outreach(db, sample_company, sample_trigger):
    brief = OutreachBrief(
        company_id=sample_company.id,
        trigger_id=sample_trigger.id,
        contact_name="Jane Smith",
        contact_role="CTO",
        contact_email="jane.smith@acme.com",
        contact_linkedin="https://linkedin.com/in/jane-smith",
        contact_phone="+1-555-019-42",
        subject="Thoughts on Acme's cloud journey after the Series B",
        body="Hi Jane, I saw Acme's recent raise and wanted to reach out about cloud modernization...",
        linkedin_draft="Hi Jane, congrats on the Series B! Would love to connect.",
        whatsapp_draft="Hi Jane, sent you an email about Acme's cloud strategy.",
        persona="CTO",
        recommended_send_time=datetime.utcnow() + timedelta(days=1),
    )
    db.add(brief)
    db.commit()
    db.refresh(brief)
    return brief


@pytest.fixture
def relanto_services(db):
    services = [
        RelantoService(
            name="Cloud Modernization",
            description="Accelerate cloud adoption and migrate legacy infrastructure.",
            pain_points_solved="Legacy systems, scaling issues, cloud migration complexity.",
            associated_triggers="Funding, Expansion, Cloud Migration",
        ),
        RelantoService(
            name="AI Automation",
            description="Implement AI-driven workflows and intelligent process automation.",
            pain_points_solved="Manual processes, inefficiency, data silos.",
            associated_triggers="AI Adoption, Product Launch, Hiring Surge",
        ),
    ]
    db.add_all(services)
    db.commit()
    return services


# ── Auth header helper ────────────────────────────────────────────────────────
def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
