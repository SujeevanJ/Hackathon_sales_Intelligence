# Relanto Sales Intelligence Pipeline

An AI-driven sales intelligence platform built for modern B2B sales teams. The pipeline autonomously monitors 51 enterprise targets, scrapes public data feeds concurrently, uses task-specialized Small Language Models (SLMs) to detect strategic buying triggers, scores each outreach opportunity against a readiness threshold, and routes qualified leads through a mandatory human approval workflow before any email is ever sent.

---

## 🌟 Key Features

1. **Role-Based Access Control (RBAC):** Secure JWT authentication isolating lead views. Admins see everything; Sales Reps only see triggers assigned directly to them.
2. **Concurrent Scraping Engine:** Monitors 51 enterprise companies simultaneously across hundreds of RSS/News feeds using `ThreadPoolExecutor` — no bottlenecking.
3. **Two-Stage AI Pre-Filtering:** A blazing-fast strategic keyword scanner drops ~90% of generic news noise before it reaches the SLM, preventing API rate limits and saving inference costs.
4. **Task-Specialized SLM Pipeline:** Three purpose-built Small Language Models handle different tasks — trigger detection, persona inference, and outreach generation — each chosen for the right balance of speed, cost, and quality.
5. **Outreach Readiness Scoring:** Every outreach brief receives a composite 0–100 score across 4 factors. Only briefs scoring ≥ 70 are marked green and eligible for outreach. Below-threshold briefs are blocked automatically.
6. **Human-in-the-Loop Approval Workflow:** No email is ever sent autonomously. Every AI-generated brief passes through a mandatory two-stage review: Sales Rep edits and submits → Manager approves → Email sent. The AI drafts, the human decides.
7. **Intelligent Lead Routing:** Newly detected triggers are auto-assigned to active Sales Reps for review.
8. **Live Sandbox Environment:** A fully detached Mock Demo Corp server on port 8001 guarantees deterministic, successful AI demonstrations.

---

## 🤖 Task-Specialized SLM Architecture

Rather than routing every task through one large, expensive LLM, the pipeline uses three purpose-built Small Language Models — each matched to its task:

| Task | Model | Why This Model |
|------|-------|---------------|
| **Trigger Detection** | `llama-3.2-3b-preview` (Groq) | Fast, low-cost, strong structured JSON classification. Runs ~30× per scrape job — cost matters. |
| **Persona Inference** | `llama-3.2-3b-preview` (Groq) | Simple classification: trigger → best C-level role to contact. Speed preferred over prose quality. |
| **Outreach Generation** | `mixtral-8x7b-32768` (Groq) | Superior instruction-following and business writing quality. Drafts emails, LinkedIn, and WhatsApp copy. Runs once per trigger — quality matters here. |
| **Chatbot Intent** | `llama-3.1-8b-instant` (Groq) | Natural language → structured intent + entity extraction for the conversational co-pilot. |

> **Fallback:** Set `LLM_PROVIDER=openai` in `.env` to route all tasks through `gpt-3.5-turbo` instead.

This approach reduces Groq API costs by ~10× compared to using a large model for everything, while maintaining quality where it matters (outreach copy).

---

## 📊 Outreach Readiness Score

Every outreach brief is scored 0–100 before it can be approved or sent. The score is computed from **4 weighted factors**:

| Factor | Weight | Scoring Logic |
|--------|--------|--------------|
| **Trigger Confidence** | 40% | The SLM's own certainty about the detected signal (0.0–1.0 → 0–100 pts) |
| **Company Priority** | 20% | Account tier set during onboarding: High = 100, Medium = 55, Low = 25 |
| **Signal Recency** | 20% | Freshness of the trigger: <7 days = 100, <14d = 75, <30d = 50, <60d = 25, older = 10 |
| **Data Completeness** | 20% | Quality of contact data: verified email (+40), role/persona (+15), real name (+20), LinkedIn (+15) |

**Threshold: 70 / 100**

- **Score ≥ 70 → 🟢 GREEN** — Brief is outreach-eligible. Approval workflow can proceed.
- **Score < 70 → 🔴 RED** — Brief is blocked. Manager approval API returns HTTP 400. Email send is gated.

### Why these 4 factors?

- **Trigger Confidence** is the primary signal — if the SLM isn't sure the event is real, outreach is premature.
- **Company Priority** ensures high-value accounts get preferential treatment even with weaker signals.
- **Signal Recency** prevents sales reps from reaching out on stale news. A 60-day-old funding round is no longer a warm signal.
- **Data Completeness** reflects whether we actually have enough contact info to reach a real person. A generic `contact@domain.com` scores low (15 pts); a real `first.last@domain.com` with LinkedIn scores high.

---

## 🔐 Human-in-the-Loop Approval Workflow

**No outreach is ever sent automatically.** Every AI-generated brief must pass through a mandatory two-stage human review before any email is dispatched:

```
Trigger Detected  →  Outreach Brief Generated (AI Draft)
                            ↓
              [GATE 1] Outreach Readiness Score ≥ 70?
                       NO  → Brief saved as RED. Blocked.
                       YES → Brief saved as GREEN. Sales rep notified.
                            ↓
              Sales Rep reviews, edits the AI draft
                            ↓
              Sales Rep clicks "Submit for Approval"
                            ↓
              [GATE 2] Manager reviews in /review queue
                       REJECT → Returns to rep with reason
                       APPROVE → Email queued for send
                            ↓
              [GATE 3] approval_status = "Approved" check in send API
                            ↓
                       Email Sent  →  status = "Sent"
```

**Status lifecycle:** `Draft → Pending Approval → Approved → Sent` (or `Rejected` at any stage)

The approval endpoint (`POST /api/outreaches/{id}/approve`) enforces both gates — it will return HTTP 400 if:
- The brief's `passed_threshold` is `False` (score below 70), **OR**
- The brief is not in `Pending Approval` status

---

## 🏗️ Architecture & Data Pipeline

The system operates in a 6-stage pipeline:

### Stage 1 — Data Collection (`scraper_service.py`)
`POST /api/scraper/run` triggers a `ThreadPoolExecutor` that concurrently scrapes all 51 target companies. Each company's JSON-configured `public_sources` array defines which RSS feeds and careers pages to hit.

### Stage 2 — Persistence & De-duplication (`ScrapedArticle`)
All scraped articles are inserted into the database. A unique constraint on the `url` column silently ignores previously seen articles.

### Stage 3 — Heuristic Pre-Filter (`trigger_service.py`)
Every new article is scanned against a strategic keyword matrix (`"raise", "series", "fund", "cloud", "ai", "merger"` etc.). Non-matching articles are marked `is_processed=True` and discarded without touching the SLM — saving ~90% of API calls.

### Stage 4 — SLM Trigger Analysis (`llama-3.2-3b-preview`)
Matching articles are sent to the Trigger Detection SLM. The model returns structured JSON:
```json
{
  "has_trigger": true,
  "event_type": "Funding",
  "summary": "...",
  "business_impact": "...",
  "recommended_service": "Cloud Migration Services",
  "confidence_score": 0.87
}
```
If `confidence_score > 0.60`, a `TriggerEvent` is created and assigned to a Sales Rep.

### Stage 5 — Outreach Readiness Scoring
Before generating outreach content, the pipeline computes the 4-factor readiness score. The score, `passed_threshold` flag, and full breakdown are saved to the `OutreachBrief` record. If `passed_threshold=False`, the pipeline saves the draft but skips content generation and email sending.

### Stage 6 — Human Approval & Controlled Send
Sales Rep reviews and edits the AI draft → submits for manager approval → manager approves via the `/review` queue → email sent via SMTP only after `approval_status = "Approved"` is confirmed.

---

## 🚀 Quick Start

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Seed database (run once)
curl -X POST http://localhost:8000/api/seed

# 3. Frontend
cd frontend
npm install && npm run dev   # http://localhost:5173

# 4. Chatbot microservice
cd chatbot_service
uvicorn main:app --reload --port 8002

# 5. Mock sandbox (optional)
cd mock_website
uvicorn main:app --reload --port 8001
```

**Login credentials (all use password `Hackathon2026!`):**
- `admin` — sees all triggers, manages approval queue
- `sales_rep1` / `sales_rep2` / `sales_rep3` — see only their assigned triggers

---

## 🧪 Postman API Testing Guide

### 1. Get Authentication Token
- **POST** `http://localhost:8000/api/auth/login`
- Body (`x-www-form-urlencoded`): `username=sales_rep1`, `password=Hackathon2026!`
- Returns `{ "access_token": "..." }` — copy this token.

### 2. Run the Intelligence Pipeline
- **POST** `http://localhost:8000/api/scraper/run`
- No auth required. Expected response:
```json
{
    "scraper": { "message": "Scraping completed for 51 active companies concurrently." },
    "processor": { "message": "Processed 50 articles. Skipped 48. Found 2 new triggers." }
}
```

### 3. View RBAC-Filtered Triggers
- **GET** `http://localhost:8000/api/triggers/` — Bearer token required
- `sales_rep1` sees only their assigned triggers. `admin` sees all.

### 4. View Outreach Brief with Readiness Score
- **GET** `http://localhost:8000/api/outreaches/trigger/{trigger_id}` — Bearer token required
- Returns the full brief including `outreach_score`, `passed_threshold`, and `score_breakdown`.

### 5. Submit Brief for Approval (Sales Rep)
- **POST** `http://localhost:8000/api/outreaches/{brief_id}/submit` — Bearer token required
- Moves status `Draft → Pending Approval`.

### 6. Approve Brief (Admin Only)
- **POST** `http://localhost:8000/api/outreaches/{brief_id}/approve` — Admin token required
- Returns HTTP 400 if score < 70 or status is not `Pending Approval`.

### 7. View Pending Approval Queue (Admin Only)
- **GET** `http://localhost:8000/api/outreaches/pending` — Admin token required

---

## 🛠️ Sandbox Demo Instructions

1. Ensure the main API (`port 8000`) and mock server (`port 8001`) are running.
2. Inject a simulated trigger: **POST** `http://localhost:8001/publish`
3. Run the pipeline: **POST** `http://localhost:8000/api/scraper/run`
4. Log in as `admin` and check `GET /api/triggers/` — the mock article will appear as a new trigger with a readiness score.
5. Navigate to the outreach brief to see the GREEN/RED score card and approval workflow.
