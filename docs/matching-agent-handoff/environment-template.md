# Environment template for matching agent handoff

**Do not commit a filled-in copy of this file.** Share credentials only through a secure channel, or paste them once into the agent chat as ephemeral context.

Provide the receiving agent with:

## PostgreSQL

| Variable | Meaning |
|---------|---------|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:PORT/DATABASE` — used by backend (`DBManager`) and Node matcher persistence / pgvector when enabled. |

Schema parameters (often from `backend/config.py` or env):

| Variable | Meaning |
|---------|---------|
| `DB_SCHEMA` | Schema holding scraped job listings (**default `scrapped_data` in `backend/config.py` if unset**). |
| `CANDIDATE_SCHEMA` | Schema for candidates + default persistence tables (**default `candidate_details`**). |

## Job listings (scraped data)

Reads use a **Union** over:

- `{DB_SCHEMA}.active_scraped_data`
- `{DB_SCHEMA}.inactive_scraped_data`

Important columns referenced by integration code include: `serial_no`, `url`, `title`, `company`, `location`, `salary`, `posted_date`, `job_type`, `workplace_type`, `description`, `skills`, `experience_required`, `keyword`, `scraped_at`.

## Candidates table

Candidates must expose at least:

- `unique_id`
- `first_name`, `last_name`
- `formatted_resume_content`, `formatted_resume_status` (**must be `completed` before `/matches/run`**)

Exact table/schema name follows your deployment’s SQLAlchemy / DB setup.

## Split vs single Postgres

If persistence + vectors use **the same** instance:

- Single `DATABASE_URL` is typical.

You may optionally set **`VECTOR_DATABASE_URL`** (Node / `vector_rank_jobs.py`) if embeddings live separately.

## Node matcher (`npm run serve`)

| Variable | Example | Notes |
|---------|---------|---------|
| `PORT` | `5051` | Matcher HTTP listens here. |
| `MATCHER_SERVICE_URL` | `http://127.0.0.1:5051/match/jobs` | Backend posts here. |

See `docs/matching-agent-behavioral-appendix.md` for `MATCH_*` table overrides, timeouts, concurrency, tailoring, and persistence flags.

## Handoff snippet for agents (paste with your real values)

```
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@YOUR_HOST:5432/YOUR_DB
# Optional if different DB for vectors:
# VECTOR_DATABASE_URL=...

# Matching service URL seen by Python:
MATCHER_SERVICE_URL=http://127.0.0.1:5051/match/jobs
```
