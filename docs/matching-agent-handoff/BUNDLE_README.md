# Matching agent — handoff bundle

This folder is everything needed to **implement or verify** the resume–job matching stack **on top of your team’s existing repo layout** (same `backend/`, `src/`, and `scripts/` paths).

## Start here

You are reading **`bundle/README.md`**. Continue in this order:

1. **`README_GENERATED.txt`** — generated checklist, git commit hint, and a longer numbered reading order.
2. **`documentation/implementation-constraints.md`** — preserve paths, minimal diff, optional tailoring.
3. **`documentation/environment-template.md`** — which env vars matter (no secrets in this bundle).
4. **`visuals/matching-agent-implementation-spec.svg`** (+ **`*-implementation-spec-visual.svg`**) — phased build narrative.
5. **`documentation/matching-agent-behavioral-appendix.md`** — clamps, SQL, persistence quirks.
6. **`documentation/matching-agent-canonical-files.json`** — authoritative file list + `sha256` baselines.
7. **`visuals/matching-agent-platform-architecture*.svg`** — full-stack context.
8. **`fixtures/matching/`** + **`backend/tests/`** — golden assertions after porting helpers.

## Folder map

| Path | Purpose |
|------|---------|
| **`documentation/`** | Markdown + JSON spec, env template, canonical manifest, `.env.example` names only |
| **`visuals/`** | Architecture and implementation SVG diagrams |
| **`fixtures/matching/`** | Golden JSON/text for Python helpers |
| **`backend/tests/`** | `unittest` contracts |
| **`scripts/`** | Fixture validator + npm notes |
| **`source-mirror/`** | Canonical copies of matching-related source at **repo-relative paths** |
| **`package-snippet-repo-root.json`** | Copy of monorepo root `package.json` for Node dependencies |

## Secrets

There are **no production secrets** in this ZIP. Use your own `.env` / vault for `DATABASE_URL`, API keys, etc.

## Tailoring service

**Optional.** To skip tailoring entirely, leave **`TAILORING_URL`** unset. Core matching still runs.

## After merge (sanity)

From a full clone with `PYTHONPATH` pointed at `backend/`:

```bash
cd backend && PYTHONPATH=. python -m unittest tests.test_matching_integration_contracts -v
```

## Maintainer note

How this bundle was produced: **`documentation/HANDOFF_FOLDER_README.md`** (export / zip instructions for the team).
