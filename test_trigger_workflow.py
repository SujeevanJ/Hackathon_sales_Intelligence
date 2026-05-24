import os
import sys
import time
import subprocess
import requests
import logging

# Set up logging to console only for clean output
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Add backend folder to python path so we can import app modules directly
WORKSPACE_ROOT = os.path.abspath(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(WORKSPACE_ROOT, "backend")
sys.path.insert(0, BACKEND_DIR)

# Load database environment variables before SQLAlchemy initializes
from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

# Import application core services and models
try:
    from app.database import SessionLocal
    from app.models import Company, ScrapedArticle, TriggerEvent, OutreachBrief, User
    from app.services.scraper_service import run_company_scraper
except ImportError as e:
    print(f"Error: Failed to import backend modules. Make sure you are running this from the virtual environment.")
    print(f"Details: {e}")
    sys.exit(1)

MOCK_SITE_URL = "http://localhost:8001"

def check_mock_website():
    """Checks if the mock website server is healthy and running on Port 8001."""
    try:
        response = requests.get(MOCK_SITE_URL, timeout=2)
        if response.status_code == 200:
            return True
    except requests.exceptions.RequestException:
        pass
    return False

def start_mock_website():
    """Dynamically launches the mock website on port 8001 inside a background process."""
    print("[MOCK WEBSITE] Server is not running. Starting mock_website.main:app on port 8001...")
    
    # Path to the virtual environment's python or uvicorn
    venv_python = os.path.join(WORKSPACE_ROOT, "venv", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        venv_python = "python" # fallback
        
    proc = subprocess.Popen(
        [venv_python, "-m", "uvicorn", "mock_website.main:app", "--port", "8001"],
        cwd=WORKSPACE_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for server to start up
    for i in range(10):
        time.sleep(1.0)
        if check_mock_website():
            print("[MOCK WEBSITE] Server successfully started and reachable on http://localhost:8001!")
            return proc
            
    print("[MOCK WEBSITE ERROR] Failed to start mock website server. Check if port 8001 is already in use.")
    proc.terminate()
    sys.exit(1)

def run_test_workflow():
    print("=" * 80)
    print("STARTING TARGETED B2B SALES INTELLIGENCE WORKFLOW TEST")
    print("=" * 80)
    
    # Step 1: Start Mock Website if not running
    website_proc = None
    if not check_mock_website():
        website_proc = start_mock_website()
    else:
        print("[MOCK WEBSITE] Server is already running on http://localhost:8001!")
        
    # Step 2: Create a unique mock B2B trigger event
    timestamp_id = int(time.time())
    title = f"Relanto Demo Corp Appoints Dr. Evelyn Drake as VP of AI Strategy & Cloud Modernization {timestamp_id}"
    content = (
        f"Relanto Demo Corp, a global pioneer in technology sandbox simulations, today announced that Dr. Evelyn Drake "
        f"has joined the executive leadership team as Vice President of AI Strategy and Cloud Modernization. Dr. Drake, "
        f"formerly a Principal Architect at a leading hyper-scaler, will oversee the integration of advanced Retrieval-Augmented "
        f"Generation (RAG) paradigms, agentic multi-model orchestration, and enterprise Snowflake/Databricks cloud data platform integrations. "
        f"The company plans to significantly increase investment in deep learning infrastructure and SaaS application scaling. "
        f"This strategic shift aims to position Relanto Demo Corp at the absolute forefront of enterprise cognitive automation. "
        f"Unique Trigger Token: {timestamp_id}"
    )
    
    payload = {
        "title": title,
        "content": content,
        "source_type": "news"
    }
    
    print("\n[1/5] Injecting strategic news article into mock website...")
    try:
        response = requests.post(f"{MOCK_SITE_URL}/publish", json=payload, timeout=5)
        if response.status_code == 200:
            print(f"   News successfully published! Title: \"{title}\"")
        else:
            print(f"   Failed to inject article: {response.text}")
            if website_proc:
                website_proc.terminate()
            sys.exit(1)
    except Exception as e:
        print(f"   Network error communicating with mock website: {e}")
        if website_proc:
            website_proc.terminate()
        sys.exit(1)
        
    # Open DB Session
    db = SessionLocal()
    
    try:
        # Step 3: Run target scraper for Relanto Demo Corp (ID = 1)
        print("\n[2/5] Running Google News RSS scraper for Relanto Demo Corp (Company ID = 1)...")
        run_company_scraper(db, company_id=1)
        
        # Verify the scraped article exists in DB
        article = db.query(ScrapedArticle).filter(ScrapedArticle.title == title).first()
        if not article:
            print("   Error: Scraped article was not found in the database. Scraper run might have failed.")
            return
        print(f"   Scraped article successfully imported to DB! Article ID: {article.id}")
        
        # Step 4: Run targeted trigger analysis & outreach generation directly
        print("\n[3/5] Performing targeted trigger analysis on our specific article...")
        from app.services.trigger_service import analyze_article
        
        trigger = analyze_article(db, article)
        
        # Mark article as processed so it is completed
        article.is_processed = True
        db.commit()
        
        if not trigger:
            print("   Error: Strategic analyzer failed to identify a trigger event for this article.")
            return
            
        print(f"   Trigger Event Identified successfully! Trigger ID: {trigger.id}")
        print("   Directly executing B2B Outreach Pipeline (Dynamic B2B lookup & message generation)...")
        
        from app.services.outreach_service import process_outreach_pipeline
        brief = process_outreach_pipeline(db, trigger.id)
        
        if not brief:
            print("   Error: B2B outreach generation failed.")
            return
            
        # Step 5: Print final results
        print("\n[4/5] Retrieving B2B Sales outreach results from database...")
        print("   Strategic Trigger Event Found:")
        print(f"      - Event Type:         {trigger.event_type}")
        print(f"      - Summary:            {trigger.summary}")
        print(f"      - Business Impact:    {trigger.business_impact}")
        print(f"      - Recommended Service:{trigger.recommended_service}")
        print(f"      - Confidence Score:   {trigger.confidence_score}")
        print(f"      - Status Indicator:   {trigger.status}")
        
        print("\n[5/5] GENERATED COLD OUTREACH ASSETS (Hunter.io / Apollo.io Dynamic Verification):")
        print("-" * 80)
        print(f"Target Executive Name:   {brief.contact_name}")
        print(f"Executive Role/Title:     {brief.contact_role} ({brief.persona})")
        print(f"Verified Corporate Email: {brief.contact_email}")
        print(f"LinkedIn Profile URL:     {brief.contact_linkedin}")
        print("-" * 80)
        print(f"COLD EMAIL CAMPAIGN SUBJECT:\n   {brief.subject}\n")
        print(f"COLD EMAIL CAMPAIGN BODY:\n{brief.body}\n")
        print("-" * 80)
        print(f"LINKEDIN CONNECTION DRAFT:\n{brief.linkedin_draft}\n")
        print("-" * 80)
        print(f"WHATSAPP CHAT NUDGE:\n{brief.whatsapp_draft}\n")
        print("=" * 80)
        print(f"SUCCESS! Workflow complete. The trigger status is currently: {trigger.status}")
        print("=" * 80)
        
    except Exception as ex:
        print(f"Core runtime error: {ex}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        # Clean up mock website background server if we started it
        if website_proc:
            print("\nTerminating background mock website server process...")
            website_proc.terminate()
            website_proc.wait()
            print("Mock website successfully terminated.")

if __name__ == "__main__":
    run_test_workflow()
