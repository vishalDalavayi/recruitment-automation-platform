# Matching agent contract fixtures

Use these artifacts with `docs/matching-agent-behavioral-appendix.md` and `docs/matching-agent-canonical-files.json`.

| File | Role |
|------|------|
| `formatted-resume-sample.json` | Minimal formatted resume payload shape accepted by `render_formatted_resume_content`. |
| `formatted-resume-rendered.expected.txt` | **Golden output** byte-for-byte (UTF-8, trailing newline only as in file). |
| `scraped-job-row.sample.json` | Example row shaped like `_fetch_jobs_for_matching` union output. |
| `job-mapped-for-matcher.expected.json` | **Golden output** of `_map_jobs_for_matcher` for the sample row. |
| `post-match-jobs-request.python-style.sample.json` | Skeleton body produced by `run_candidate_matching` (`jobs[]` populated at runtime). |

## Automated checks

- **Python (no pytest required):** from `backend/`,  
  `PYTHONPATH=. python -m unittest tests.test_matching_integration_contracts -v`
- **Fixture shape (Node):** from repo root,  
  `npm run validate:matching-fixtures` or `node scripts/validate-matching-fixtures.js`

Full HTTP responses from `POST /match/jobs` are **not** golden-filed here: scores embed model/Tfidf/pgvector state. Assert on response schema, persistence flags, and use DB snapshots for regressions instead.
