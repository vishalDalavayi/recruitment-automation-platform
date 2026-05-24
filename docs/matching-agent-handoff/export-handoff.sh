#!/usr/bin/env bash
# Build docs/matching-agent-handoff/bundle/ with artifacts for handing to another agent.
set -euo pipefail

WITH_SOURCES=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUT="${SCRIPT_DIR}/bundle"

usage() {
  echo "Usage: $0 [--with-sources]" >&2
  echo "  --with-sources  Also mirror canonical paths from docs/matching-agent-canonical-files.json" >&2
}

for arg in "$@"; do
  case "${arg}" in
    --with-sources) WITH_SOURCES=true ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: ${arg}" >&2
      usage
      exit 1
      ;;
  esac
done

rm -rf "${OUT}"
mkdir -p "${OUT}/visuals" "${OUT}/documentation" "${OUT}/fixtures/matching" \
  "${OUT}/backend/tests" "${OUT}/scripts" "${OUT}/source-mirror"

copy_one() {
  local rel="$1"
  local dst="${OUT}/${2}"
  local src="${REPO_ROOT}/${rel}"
  if [[ ! -f "${src}" ]]; then
    echo "SKIP missing ${rel}"
    return
  fi
  mkdir -p "$(dirname "${dst}")"
  cp -f "${src}" "${dst}"
}

for f in \
  docs/matching-agent-implementation-spec.svg \
  docs/matching-agent-implementation-spec-visual.svg \
  docs/matching-agent-platform-architecture.svg \
  docs/matching-agent-platform-architecture-visual.svg \
  docs/matching-agent-architecture.svg \
  docs/matching-agent-architecture-visual.svg
do
  copy_one "${f}" "visuals/$(basename "${f}")"
done

copy_one docs/matching-agent-behavioral-appendix.md documentation/matching-agent-behavioral-appendix.md
copy_one docs/matching-agent-canonical-files.json documentation/matching-agent-canonical-files.json

copy_one docs/fixtures/matching/README.md documentation/fixtures-README-from-repo.md
copy_one docs/fixtures/matching/formatted-resume-sample.json fixtures/matching/formatted-resume-sample.json
copy_one docs/fixtures/matching/formatted-resume-rendered.expected.txt fixtures/matching/formatted-resume-rendered.expected.txt
copy_one docs/fixtures/matching/scraped-job-row.sample.json fixtures/matching/scraped-job-row.sample.json
copy_one docs/fixtures/matching/job-mapped-for-matcher.expected.json fixtures/matching/job-mapped-for-matcher.expected.json
copy_one docs/fixtures/matching/post-match-jobs-request.python-style.sample.json fixtures/matching/post-match-jobs-request.python-style.sample.json

copy_one backend/tests/test_matching_integration_contracts.py backend/tests/test_matching_integration_contracts.py
copy_one backend/tests/__init__.py backend/tests/__init__.py
copy_one scripts/validate-matching-fixtures.js scripts/validate-matching-fixtures.js
copy_one package.json package-snippet-repo-root.json
copy_one backend/requirements.txt documentation/backend-requirements.txt
copy_one backend/.env.example documentation/backend-env-example-no-secrets-from-repo.txt

cp -f "${SCRIPT_DIR}/environment-template.md" "${OUT}/documentation/environment-template.md"
cp -f "${SCRIPT_DIR}/implementation-constraints.md" "${OUT}/documentation/implementation-constraints.md"
cp -f "${SCRIPT_DIR}/README.md" "${OUT}/documentation/HANDOFF_FOLDER_README.md"

cat >"${OUT}/scripts/package-snippet-scripts-dir.txt" <<'SNIP'
# From repo root, run:
# npm run validate:matching-fixtures
# If you unpacked only bundle/, run node with cwd adjusted so paths match (see README_GENERATED).
SNIP

if [[ "${WITH_SOURCES}" == true ]]; then
  python3 << PY
import json, shutil, pathlib
repo = pathlib.Path("${REPO_ROOT}")
out_src = pathlib.Path("${OUT}") / "source-mirror"
manifest_path = repo / "docs/matching-agent-canonical-files.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
for entry in manifest.get("files", []):
    src = repo / pathlib.Path(entry["path"])
    if not src.is_file():
        continue
    dst = out_src / pathlib.Path(entry["path"])
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
PY
fi

GIT_SHA=""
git -C "${REPO_ROOT}" rev-parse --short HEAD >/dev/null 2>&1 && GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo unknown)"

SOURCES_LINE="none (re-export with --with-sources to include)."
[[ "${WITH_SOURCES}" == true ]] && SOURCES_LINE="see source-mirror/"

GENERATED="${OUT}/README_GENERATED.txt"
cat >"${GENERATED}" <<EOF
Matching agent handoff bundle (generated)
Generated from repo-root commit-ish: ${GIT_SHA:-unknown}
========================================

Reading order:
  See README.md (bundle root) first.

  0) documentation/implementation-constraints.md (minimal diff, preserve paths, tailoring optional)
  1) documentation/environment-template.md (DB URLs, schemas; provide secrets privately to the agent)
  2) visuals/matching-agent-implementation-spec.svg + matching-agent-implementation-spec-visual.svg
  3) documentation/matching-agent-behavioral-appendix.md (clamps, SQL, mappings, quirks)
  4) visuals/matching-agent-platform-architecture*.svg (+ architecture*.svg if needed)
  5) documentation/matching-agent-canonical-files.json (paths + SHA-256 parity)
  6) documentation/backend-requirements.txt + backend-env-example-no-secrets-from-repo.txt (deps + placeholder env keys)
  7) package-snippet-repo-root.json (= root package.json) for npm install
  8) fixtures/matching/ ... + backend/tests/ for golden assertions

Included implementation source snapshot: ${SOURCES_LINE}

Repository layout (team parity):
  Merge code using the SAME paths as source-mirror/ and documentation/matching-agent-canonical-files.json
  (e.g. backend/services/matching_integration.py, src/server.js, scripts/vector_rank_jobs.py).
  Do not relocate into a single ad-hoc folder unless the target codebase truly has no backend/ or src/ tree.
  Register FastAPI routes and scheduler hooks in the same modules the diagram names (candidates router, scheduler service, cli).
  After changes, update sha256 entries in matching-agent-canonical-files.json or diff against source-mirror/.

Database note for downstream agent:
  Jobs live under DB_SCHEMA: tables active_scraped_data and inactive_scraped_data (scraped listings),
  unioned for matching workloads; same Postgres as DATABASE_URL for this project.
  Candidates + formatted resumes follow your Candidate ORM/table layout.

Tests (when inside full repo clone — keep backend/ layout):
  cd backend && PYTHONPATH=. python -m unittest tests.test_matching_integration_contracts -v

This ZIP snippet path layout: unzip at any location; copy files into an existing clone preserving paths under
  backend/, src/, and scripts/ so imports and npm/python entrypoints match the rest of the team's repo.

Implementation discipline (see implementation-constraints.md):
  Minimal diff only: no unrelated refactors, no extra files beyond canonical paths, no unnecessary lines.
  Tailoring: OPTIONAL. Leave TAILORING_URL unset to skip downstream tailoring; matcher still works.

README files in this bundle:
  - README.md — human-readable entry (start here)
  - README_GENERATED.txt — generated checklist + commit-ish + detailed order
  - documentation/HANDOFF_FOLDER_README.md — maintainer zip/export notes
EOF

cp -f "${SCRIPT_DIR}/BUNDLE_README.md" "${OUT}/README.md"

echo ""
echo "Wrote: ${OUT}"
echo "ZIP: (cd '${SCRIPT_DIR}' && zip -qr matching-agent-handoff.zip bundle/)"
