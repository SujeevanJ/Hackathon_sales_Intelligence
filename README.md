# Relanto Sales Intelligence Pipeline

An AI-driven, multi-tenant backend built for modern sales teams. This pipeline autonomously monitors 51 enterprise targets, scrapes public data feeds concurrently, uses Small Language Models (SLMs) to detect strategic buying triggers (like funding rounds or cloud expansions), and automatically routes leads to human sales representatives.

---

## 🌟 Key Features

1. **Role-Based Access Control (RBAC):** Secure JWT authentication isolating lead views. Admins see everything, while Sales Reps only see triggers assigned directly to them.
2. **Concurrent Scraping Engine:** Monitors 50+ enterprise companies simultaneously across hundreds of RSS/News feeds without bottlenecking.
3. **AI Heuristic Pre-Filtering:** A blazing-fast strategic keyword scanner that drops 90% of generic news noise instantly, preventing API rate limits and saving LLM costs.
4. **SLM-Powered Trigger Detection:** Utilizes Meta's hyper-fast `Llama-3.1-8b-instant` model on Groq to map raw news articles to actionable Relanto Service Offerings (e.g., Cloud Modernization, Data Engineering).
5. **Intelligent Lead Routing:** Newly discovered triggers are automatically and randomly assigned to active Sales Reps for immediate human outreach.
6. **Live Sandbox Environment:** Includes a completely detached Mock Demo Corp server running on port 8001 to guarantee deterministic, successful AI demonstrations and sandbox testing.

---

## 🏗️ Architecture & Data Workflow

The system operates in a 5-stage automated pipeline:

### 1. Data Collection (`scraper_service.py`)
The `POST /api/scraper/run` endpoint is triggered. A `ThreadPoolExecutor` spins up concurrent workers for all 51 target companies. It dynamically reads their JSON-configured public sources and scrapes raw HTML/XML feeds into memory.

### 2. Persistence & De-duplication (`ScrapedArticle`)
All scraped articles are inserted into the PostgreSQL (Supabase) database. A strict unique constraint on the `url` column ensures that if a news article has been seen before, it is silently ignored and never re-processed.

### 3. Heuristic Pre-Filtering (`trigger_service.py`)
Before touching the AI, the backend scans every new article against a strategic keyword matrix (e.g., `"raise", "layoff", "cloud", "ai", "merger"`). 
* **No Match:** The article is marked `is_processed = True` and discarded.
* **Match Found:** The article advances to the AI.

### 4. Deep SLM Analysis (`Groq API`)
The raw text is sent to the `Llama-3.1-8b-instant` Small Language Model. The prompt instructs the LLM to analyze the business context and strictly return a JSON object mapping the news to a Relanto Service, along with a confidence score.

### 5. RBAC Auto-Assignment (`TriggerEvent`)
If the AI confidence score is > 60%, a `TriggerEvent` is created. The backend queries the `User` database, pulls all users with the `sales_rep` role, and randomly assigns the trigger to one of them. The status is updated to `"Assigned"`.

---

## 🚀 Postman API Testing Guide

Start your backend server (`uvicorn app.main:app --reload --port 8000`) and the mock server (`uvicorn main:app --reload --port 8001`). 
Use the following endpoints to verify the system end-to-end.

### 1. Get Authentication Token
* **Method:** `POST`
* **URL:** `http://localhost:8000/api/auth/login`
* **Body:** `x-www-form-urlencoded`
  * `username`: `sales_rep1` (or `sales_rep2`, `sales_rep3`, `admin`)
  * `password`: `Hackathon2026!`
* **Expected Result:** Status 200 OK. Returns a JSON object with an `access_token`. **Copy this token.**

### 2. Run the Intelligence Pipeline
* **Method:** `POST`
* **URL:** `http://localhost:8000/api/scraper/run`
* **Headers:** No auth required for the scraper worker.
* **Expected Result:** Status 200 OK. 
```json
{
    "scraper": {
        "message": "Scraping completed for 51 active companies concurrently."
    },
    "processor": {
        "message": "Processed 50 articles. Skipped 48. Found 2 new triggers."
    }
}
```

### 3. View RBAC-Protected Triggers
* **Method:** `GET`
* **URL:** `http://localhost:8000/api/triggers/`
* **Headers:** 
  * Go to `Authorization` tab -> Select `Bearer Token`.
  * Paste the copied `access_token` from Step 1.
* **Expected Result:** Status 200 OK. If logged in as `sales_rep1`, you will ONLY see the triggers whose `assigned_to_id` matches your User ID. If logged in as `admin`, you will see all triggers across the entire platform.

### 4. View Target Companies
* **Method:** `GET`
* **URL:** `http://localhost:8000/api/companies/`
* **Expected Result:** Status 200 OK. Returns the JSON array of all 51 targeted enterprises, including Relanto Demo Corp.

### 5. View Specific Company History
* **Method:** `GET`
* **URL:** `http://localhost:8000/api/companies/1/triggers`
* **Expected Result:** Status 200 OK. Returns the complete, chronological history of every AI trigger ever generated specifically for Company ID 1 (Demo Corp).

---

## 🛠️ Sandbox Demo Instructions

To guarantee a perfect sandbox test run:
1. Ensure both the main API and mock servers are running.
2. In Postman, hit `POST http://localhost:8001/publish` to inject a simulated "$50M Series B Cloud Expansion" article into the Mock Demo Corp website.
3. Hit `POST http://localhost:8000/api/scraper/run`. The backend heuristic queue will process Demo Corp (`company_id=1`), guaranteeing your mock article is immediately sent to the Groq AI for analysis.
4. Log in as an Admin and hit `GET /api/triggers/` to view the successfully mapped JSON trigger output.
