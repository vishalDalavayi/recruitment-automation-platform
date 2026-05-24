# KonfigAI Job Digger — Production Scraper & Dashboard

A production-grade job scraping and talent operations platform with a layered FastAPI backend, React dashboard, and AI-assisted resume workflows. Built for fast startup, high concurrency, and independent service scaling.

## Engineering Highlights

- **Layered FastAPI architecture** — Router → Service → Repository separation with thin handlers, pooled DB sessions, and request-scoped dependencies
- **Redis caching and keyset pagination** — Stats and filter endpoints cached (Redis with in-memory fallback); paginated job listings designed for large datasets
- **Azure Blob Storage integration** — Service Principal auth with SAS signing for private resume and document access
- **AI-powered resume formatting pipeline** — LLM-driven extraction and ATS-oriented formatting for uploaded candidate resumes
- **Independent service deployment** — API, scheduler, and scraper worker run as separate processes via `cli.py`

## My Contributions

I focused on backend integration, matching workflows, and service wiring:

- Integrated **candidate-to-job matching** end-to-end: FastAPI service layer (`matching_integration.py`), candidate API endpoints, and a Node.js matcher HTTP service under `src/`
- Added **scheduled matching automation** — daily batch triggers wired into the CLI and scheduler lifecycle
- Built matcher-side **resume and job normalization** (text extraction, section parsing, scoring agents) and persistence hooks for match results
- Extended **configuration and deployment wiring** for production-style `DATABASE_URL` usage alongside existing PostgreSQL schema settings
- Connected matching output to downstream **resume tailoring** handoff so ranked jobs can feed the formatting/tailoring pipeline

## Screenshots

> Add captures to `screenshots/` to replace these placeholders.

| Dashboard | Candidate talent pool |
|---|---|
| ![Dashboard overview](screenshots/dashboard.png) | ![Candidate management](screenshots/candidates.png) |

| Scraper status | Resume formatting |
|---|---|
| ![Scraper status and controls](screenshots/scraper-status.png) | ![AI resume formatting workflow](screenshots/resume-formatting.png) |

## Demo

**Video walkthrough:** _Coming soon — Loom link will be added here._

Local setup instructions are below if you want to run the stack yourself.

## Key Features

- **Automated Intelligence Scraper** — High-density Dice job scraper with dual-thread management and bot detection bypass
- **Candidate Talent Pool** — Registration and management with PDF resume portfolio support
- **AI Resume Formatting** — LLM-powered ATS-compliant resume extraction and formatting pipeline
- **Azure Cloud Integration** — Secure Service Principal (SPN) authentication with automated **SAS (Shared Access Signature)** signing for private blob access
- **Premium UX/UI** — Dashboard using **Plus Jakarta Sans** typography, glassmorphism elements, and high-density data grids
- **Advanced Performance** — Keyset pagination, GZIP compression, connection pooling, and Redis caching for high-scale data management

## Future Improvements

- Hosted production demo with read-only sample data
- Richer resume-to-job ranking (embeddings, explainability, and tuning)
- Better observability dashboard (metrics, tracing, and alerting)
- Role-based admin controls for multi-user operations
- CI/CD pipeline with automated tests and staged deployments

## Tech Stack

- **Backend**: FastAPI (Python 3.10+), SQLAlchemy, PostgreSQL, Redis, Azure Blob Storage
- **Frontend**: React 19, Vite, Recharts, Lucide Icons
- **Matching service**: Node.js (Express-style HTTP server under `src/`)
- **Auth & Security**: API key authentication, Service Principal (SPN) / Managed Identity support
- **Observability**: Structured logging with request ID tracing, health/readiness probes

---

## Quick Start

### 1. Environment Configuration (.env)

Copy the example files and fill in your values locally. **Do not commit `.env` files** — they are gitignored.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env   # optional — defaults to localhost API
```

Edit `backend/.env`:

```bash
# Database
DB_HOST=your_host
DB_PORT=5432
DB_NAME=your_db
DB_USER=your_user
DB_PASS=your_password
DB_SCHEMA=scrapped_data
CANDIDATE_SCHEMA=candidate_details

# Redis (optional — falls back to in-memory cache)
REDIS_URL=redis://localhost:6379/0

# Azure Blob Storage (Service Principal)
AZURE_STORAGE_ACCOUNT_NAME=your_account
AZURE_CLIENT_ID=your_spn_id
AZURE_CLIENT_SECRET=your_spn_secret
AZURE_TENANT_ID=your_tenant_id
AZURE_CONTAINER_NAME=your_container
AZURE_RAW_RESUME_PATH=Resume-intelligence/candidate-raw-resumes/
AZURE_FORMATTED_RESUME_PATH=Resume-intelligence/candidate-formatted-resumes/
AZURE_CONFIDENTIAL_DOCUMENTS_PATH=candidate_confidential_documents/

# API Security
SCRAPER_API_KEY=your-secure-key
```

### 2. Startup

**Backend (from repo root):**

```bash
pip install -r backend/requirements.txt

# Production — run services independently
python backend/cli.py --service api          # API only (starts in < 3 seconds)
python backend/cli.py --service scheduler    # Scheduler only
python backend/cli.py --service worker       # Scraper worker only

# Development — all-in-one (legacy compatible)
python backend/cli.py --service all

# Database migrations (one-time)
python backend/cli.py --service migrate
```

**Frontend (from repo root):**

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

### Default Ports

| Service   | Port | Command                               |
|-----------|------|---------------------------------------|
| API       | 8000 | `python backend/cli.py --service api` |
| Worker    | 8001 | `python backend/cli.py --service worker` |
| Scheduler | 8002 | `python backend/cli.py --service scheduler` |
| Frontend  | 5173 | `npm --prefix frontend run dev`       |

---

## API Endpoints

### Health & Operations

| Endpoint            | Method | Description                                      |
|---------------------|--------|--------------------------------------------------|
| `GET /health`       | GET    | Liveness probe — always returns OK               |
| `GET /ready`        | GET    | Readiness probe — checks DB + Redis connectivity |
| `GET /init`         | GET    | Consolidated startup data (stats + settings)     |
| `GET /status`       | GET    | Real-time scraper status                         |
| `GET /stats`        | GET    | Dashboard analytics (cached, 5s TTL)             |

### Jobs

| Endpoint              | Method | Description                                    |
|-----------------------|--------|------------------------------------------------|
| `GET /jobs`           | GET    | Paginated jobs with server-side filtering      |
| `GET /jobs/filters`   | GET    | Unique filter values (companies, locations)    |
| `GET /jobs/{id}`      | GET    | Full job detail including description          |

### Candidates

| Endpoint                                          | Method | Description                             |
|---------------------------------------------------|--------|-----------------------------------------|
| `GET /candidates`                                 | GET    | Search and list talent pool             |
| `POST /candidates/upload`                         | POST   | Register new candidate (multipart)      |
| `PUT /candidates/{id}`                            | PUT    | Update candidate info + documents       |
| `DELETE /candidates/{id}`                         | DELETE | Remove candidate and all Azure blobs    |
| `GET /candidates/{id}/documents/{type}`           | GET    | Download resume, passport, etc.         |
| `POST /candidates/{id}/formatted-resume/complete` | POST   | Complete AI-formatted resume            |

### Scraper Control

| Endpoint                | Method | Description                    |
|-------------------------|--------|--------------------------------|
| `POST /trigger`         | POST   | Start manual scraping pipeline |
| `POST /stop`            | POST   | Request graceful scraper stop  |
| `POST /checker/start`   | POST   | Start job URL validity checker |
| `GET /scraper/logs`     | GET    | Historical execution logs      |
| `GET /scheduler/status` | GET    | APScheduler job status         |

### Settings & Admin

| Endpoint                      | Method | Description                        |
|-------------------------------|--------|------------------------------------|
| `GET /settings`               | GET    | Current scraper configuration      |
| `POST /settings`              | POST   | Update scraper settings            |
| `GET /db/tables`              | GET    | List all database tables + counts  |
| `GET /db/tables/{name}`       | GET    | Paginated table data               |
| `GET /db/tables/{name}/info`  | GET    | Table schema information           |
| `DELETE /db/tables/{name}`    | DELETE | Clear all data from a table        |
| `POST /clear-data`            | POST   | Clear all scraped data             |

> **Swagger UI**: Visit `http://localhost:8000/docs` for interactive API docs.

---

## Project Architecture

```
backend/
├── app/                          # Application package (layered architecture)
│   ├── main.py                   # FastAPI app factory (< 50 lines)
│   ├── config.py                 # Pydantic Settings — validated env config
│   ├── dependencies.py           # DI providers (get_db, check_api_key)
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── base.py               # Engine, SessionLocal, Base (pooled connections)
│   │   ├── jobs.py               # Job-related models
│   │   └── candidates.py         # Candidate + FormattingResumeInfo
│   ├── repositories/             # Data access layer (raw SQL + ORM queries)
│   │   ├── job_repository.py     # Paginated jobs, filters, table management
│   │   ├── candidate_repository.py # Candidate CRUD
│   │   └── scraper_log_repository.py
│   ├── services/                 # Business logic layer
│   │   ├── azure_service.py      # All blob/SAS operations (lazy init)
│   │   ├── candidate_service.py  # Validation, serialization, formatting
│   │   └── stats_service.py      # Stats aggregation with caching
│   ├── routers/                  # FastAPI route handlers (thin)
│   │   ├── health.py             # /health, /ready
│   │   ├── jobs.py               # /jobs, /jobs/{id}, /jobs/filters
│   │   ├── candidates.py         # All candidate endpoints
│   │   ├── scraper.py            # /trigger, /stop, /status
│   │   ├── settings.py           # /settings, /init, /stats
│   │   └── admin.py              # /db/tables, /clear-data
│   ├── middleware/               # Cross-cutting concerns
│   │   ├── error_handler.py      # Global exception handler
│   │   └── logging_middleware.py  # Request ID + structured logging
│   └── cache/
│       └── redis_client.py       # Redis-first cache with in-memory fallback
│
├── services/                     # Legacy service modules
│   ├── common/                   # Shared state (AppState, scraper_config)
│   ├── scraper/                  # DiceScraper intelligence engine
│   ├── scheduler/                # APScheduler with PostgreSQL persistence
│   ├── resume_formatter/         # LLM-powered resume processing
│   └── matching_integration.py   # Candidate-to-job matching orchestration
│
├── cli.py                        # CLI entry point (--service api/all/scheduler/worker)
├── config.py                     # Legacy config (backward compat)
├── database.py                   # Legacy DB manager (backward compat)
└── requirements.txt

src/                              # Node.js matcher service + agents
frontend/
├── src/
│   ├── App.jsx                   # Dashboard core — all tabs and state management
│   ├── index.css                 # Premium design system (glassmorphism, typography)
│   └── main.jsx                  # Vite entry point
├── public/                       # Static assets and branding
└── vite.config.js                # HMR dev server config
```

### Architecture Layers

```
Request → Router → Service → Repository → Database
           ↓          ↓
       Middleware   Cache (Redis)
```

- **Routers**: Thin — validate input, call service, return response. All use `Depends(get_db)` for request-scoped sessions.
- **Services**: Business logic — validation, serialization, Azure operations, caching.
- **Repositories**: Data access — raw SQL and ORM queries. Accept `Session` as parameter.
- **Middleware**: Request ID injection, structured logging, global exception handling.

### DB Connection Hardening

```python
engine = create_engine(
    DATABASE_URL,
    pool_size=10,        # Persistent connection pool
    max_overflow=20,     # Burst capacity
    pool_recycle=1800,   # Recycle connections every 30 min
    pool_pre_ping=True,  # Detect dead connections before use
)
```

---

## Adding New Services

The platform supports independent service deployment. To add a new agent:

### 1. Backend: Create a New Router

```python
# app/routers/my_agent.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.dependencies import get_db, check_api_key

router = APIRouter(tags=["MyAgent"], dependencies=[Depends(check_api_key)])

@router.get("/my-agent/analyze")
def analyze(db: Session = Depends(get_db)):
    # Your logic here — DB session auto-managed
    return {"result": "analysis"}
```

### 2. Register the Router

```python
# app/main.py — add to create_app()
from app.routers import my_agent
app.include_router(my_agent.router)
```

### 3. Cross-Service Communication

- **Shared DB**: Use repositories from `app/repositories/` to access existing data.
- **Inter-service HTTP**: Use `httpx.AsyncClient` to call other services.
- **Shared Cache**: Use `from app.cache.redis_client import cache` for cross-service caching.

---

## Performance Characteristics

| Metric | Value |
|---|---|
| API cold start | < 3 seconds |
| `/health` response | < 5ms |
| `/status` response | < 10ms |
| DB connection pool | 10 persistent + 20 overflow |
| Stats cache TTL | 5 seconds (Redis or in-memory) |
| Filter cache TTL | 5 minutes |
| GZIP compression | Enabled (> 1KB responses) |
