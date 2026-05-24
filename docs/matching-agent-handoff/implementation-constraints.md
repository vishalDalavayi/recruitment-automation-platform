# Implementation constraints (for greenfield agents)

Use this document **together with** `README_GENERATED.txt` and `matching-agent-behavioral-appendix.md`.

## Preserve the team layout

1. Implement matching using **exactly** the paths under `source-mirror/` and `matching-agent-canonical-files.json` (`backend/…`, `src/…`, `scripts/…`).
2. **Merge** files into those locations; **do not** introduce a parallel package (e.g. `services/new-matching/` or a monolithic `matching/` module) unless the target repository truly has no `backend/` or `src/` tree.
3. Register routes and scheduler hooks only in the **named** modules (e.g. `candidates` router, `scheduler/service.py`, `cli.py`) as in the diagrams.

## Minimal, clean diff

1. **Scope:** Only what is required for resume–job matching, persistence, batch hook, and tests—**no drive-by refactors** of unrelated scraper, formatter, or UI code.
2. **No extra files** beyond what the canonical manifest already lists, unless the target repo is missing a path entirely (then add only the missing file at the **correct** path).
3. **No decorative code:** avoid verbose comments, redundant wrappers, or “cleanup” in files you were not asked to touch.
4. Prefer **matching** the reference in `source-mirror/` over **re-imagining** behavior; if you must deviate, document why in the PR or task summary.

## Tailoring agent (optional — skip if not needed)

1. **Tailoring is not required** for core matching. If there is no downstream tailoring service:
   - Leave **`TAILORING_URL`** unset / empty.
   - The matcher still completes; tailoring runs only when a URL or request flags enable it.
2. Do **not** delete `tailoringClient.js` if it ships in `source-mirror/`—that breaks parity with the canonical manifest and team layout. Omit env and calls only.

## Verification before “done”

1. Golden tests: see `backend/tests/test_matching_integration_contracts.py`.
2. Optional: `scripts/validate-matching-fixtures.js` when run from a full repo clone with correct `cwd`.
