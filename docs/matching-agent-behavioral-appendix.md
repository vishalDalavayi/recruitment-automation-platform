# Matching agent — behavioral appendix

This document captures **non-obvious behavior** that SVG diagrams do not pin. Use with `docs/matching-agent-canonical-files.json` (SHA-256 baselines), `docs/fixtures/matching/*`, and the Python/Node contract tests.

## Doc index

| Artifact | Purpose |
|----------|---------|
| `docs/matching-agent-canonical-files.json` | List of implementation paths + `sha256` for parity checks |
| `docs/fixtures/matching/` | Golden strings/JSON for pure Python helpers |
| `backend/tests/test_matching_integration_contracts.py` | `unittest` golden tests |
| `scripts/validate-matching-fixtures.js` | JSON shape checks for fixtures |
| SVG suite under `docs/matching-agent-*.svg` | Architecture + phased build narrative |

## Repository layout parity (team codebase)

Integrations must respect **existing monorepo paths**: Python under `backend/` (e.g. `backend/services/matching_integration.py`, `backend/app/routers/candidates.py`), Node matcher under repo-root `src/` and `scripts/`, as enumerated in `matching-agent-canonical-files.json` and mirrored in export `bundle/source-mirror/`. Preserving paths keeps imports (`from services.matching_integration import …`), subprocess cwd expectations, scheduler wiring, and `npm`/`uvicorn` entrypoints aligned with the rest of the team's repository.

## Preconditions (Python path)

- `run_candidate_matching` loads `Candidate` by `unique_id`. It **raises `ValueError`** if `formatted_resume_status != "completed"` or rendered resume text is empty.
- `get_candidate_matches` returns `{"match_run": null, "jobs": []}` if no run exists **or** if persistence tables are missing (`does not exist` / undefined table errors are swallowed).

## Integer clamps (`matching_integration.py`)

| Parameter | Fallback env | Minimum | Maximum |
|-----------|----------------|---------|---------|
| `job_limit` | `MATCH_JOB_LIMIT` | 1 | 500 |
| `top_k` | `MATCH_TOP_K` | 1 | 50 |
| `vector_top_n` | `MATCH_VECTOR_TOP_N` | **`max`(env, effective top_k)** | 500 |

`vector_top_n` is clamped **with minimum = effective top_k**, so retrieval window is never narrower than requested `top_k`.

## Job fetch SQL

- Single query unions `{DB_SCHEMA}.active_scraped_data` and `inactive_scraped_data`.
- Ordering: `order by scraped_at desc nulls last, serial_no desc limit :limit`.
- Adds literal column `source_table` (`active_scraped_data` vs `inactive_scraped_data`) for stable job ids downstream.

## Job mapping rules (`_map_jobs_for_matcher`)

- `id` = `"{source_table}:{serial_no}"` when `serial_no` is not null; else first non-empty of `url`, then `title`.
- `job_type` = first non-empty of `job_type`, then `workplace_type`.
- `publication_date` mapped from `posted_date`.
- `description_text` from `description`.

## Matcher HTTP (`run_candidate_matching`)

- `MATCHER_SERVICE_URL` default `http://127.0.0.1:5051/match/jobs`.
- `httpx.AsyncClient(timeout=180.0)`.
- Returns dict: `{ "matcher_response": <JSON>, "stored_results": get_candidate_matches(...) }`. Second field reflects DB **after** the HTTP call (persist path must succeed on Node for rows to appear).

## Node `POST /match/jobs` (`src/server.js`)

- `jobs`: required non-empty array.
- `resumeText` **or** `resumeFile` with `filename` + `contentBase64`.
- Accepts camelCase **or** snake_case for several resume/tailoring fields (`resume_id`, `tailoring_enabled`, etc.).
- `topK` clamped **1–100**; `vectorTopN` clamped **1–500**.
- **`persist === false`** or persistence disabled skips `persistMatchRun` (explicit reason string in response `persistence` block).

## Node matcher internals (`matchingAgent.js`)

- Concurrency queue: env `MATCHER_MAX_CONCURRENCY` (fallback 4); child timeout `MATCHER_CHILD_TIMEOUT_MS` (fallback 120s).
- Spawns **`MATCHER_PYTHON_BIN`** or discovers python under `.venv-compare`, `.venv311`, `.venv`, else `python3`.
- Payload to `scripts/vector_rank_jobs.py`: stdin JSON keys include `resume_text`, `jobs`, `top_k`, `vector_top_n`, `database_url`, `pgvector_table`, `embedding_model`, etc.
- If no `DATABASE_URL` / vector URL, matcher may fall back to **in-memory** vector backend (`vector_backend` differs in responses).

## Persistence (`src/db/postgres.js`)

- Gated by `MATCH_PERSISTENCE_ENABLED` defaulting **on when `DATABASE_URL` is set**.
- Table names env: `MATCH_RESUMES_TABLE`, `MATCH_JOBS_TABLE`, `MATCH_RUNS_TABLE`, `MATCH_RESULTS_TABLE` — defaults `candidate_details.candidate_match_*`.
- **`source_resume_ref` in SQL is the business id** (`unique_id`) when passed as `resumeId` from FastAPI integration.
- Tailoring statuses: constrained set (`not_requested`, `pending`, `completed`, `failed`, `disabled`).

## Scheduler / batch (`matching_automation.py`)

- Runs `NODE_BIN` (default `node`) with **`scripts/run-daily-match-batch.js`** relative to **`backend/`’s repo root parent** resolved as three `dirname`s up from the Python file (`resume-bot` root).
- Default timeout **14400 seconds** (`MATCHING_BATCH_TIMEOUT_SECONDS`).
- `MATCHING_SCHEDULE_ENABLED` truthy defaults; `MATCHING_SCHEDULE_TIME` default `01:30 PM`.
- Dedupe semantics and CLI flags documented in **`scripts/run-daily-match-batch.js`** (`--force`, `--date`, tailoring flags).

## What is intentionally *not* golden-filed

- Full `POST /match/jobs` JSON responses: embeddings, TF-IDF, and corpus state make numeric scores non-portable across runs.
- For end-to-end parity, freeze **canonical source hashes** (`matching-agent-canonical-files.json`), run **`unittest`** goldens, integration tests against Dockerized Postgres **with** seeded jobs + optional snapshot of persisted rows.

Regenerate **`sha256` entries** in `matching-agent-canonical-files.json` after editing any canonical file (`shasum -a 256 < path`).
