# Matching agent handoff folder

Bundled specs, diagrams, goldens, manifest, **and scripts to produce a single export directory** (`bundle/`) for another AI or teammate.

## Security

- **Never commit real passwords.** `bundle/` is gitignored for that reason once you populate env files locally.
- You posted database credentials in chat previously; rotate them if that channel is not fully private.
- Put secrets only in a **Secure note / password manager**, or paste once into an encrypted agent session—not into tracked files.

## One-command export

From repo root:

```bash
chmod +x docs/matching-agent-handoff/export-handoff.sh
docs/matching-agent-handoff/export-handoff.sh
```

Produces **`docs/matching-agent-handoff/bundle/`**. Zip or upload **that folder only**:

```bash
cd docs/matching-agent-handoff && zip -r matching-agent-handoff.zip bundle/
```

### Include implementation source inside the ZIP (recommended for parity)

Adds a mirror tree under `bundle/source-mirror/<path>` matching `matching-agent-canonical-files.json`:

```bash
docs/matching-agent-handoff/export-handoff.sh --with-sources
```

## Manual `DATABASE_URL` for the recipient

Copy `environment-template.md` into the bundle automatically includes placeholders. Fill in **`YOUR_DATABASE_URL`** in a separate file (e.g. `bundle/paste-secrets-only-in-chat.env`) locally—**do not commit**—or paste connection details securely.

## Minimal instructions to give the new agent

1. Open **`bundle/README.md`** in the ZIP first (human-readable entry), then **`bundle/README_GENERATED.txt`**.
2. **Preserve team file layout** and **minimal diff**: `bundle/documentation/implementation-constraints.md` (no drive-by refactors, no extra files, paths as in `source-mirror/`). Tailoring is **optional**—leave `TAILORING_URL` unset to skip.
3. Continue with `README_GENERATED.txt` (numbered order).
4. Read `bundle/documentation/implementation-constraints.md`, then behavioral appendix + diagrams.
5. Follow SVG phase order under `bundle/visuals/`.
6. Run goldens after porting helpers: see `bundle/documentation/fixtures-README-from-repo.md`.

## Maintainer list (what export copies)

- All `docs/matching-agent-*.svg` (implementation, platform, architecture + `*-visual` variants)
- `docs/matching-agent-behavioral-appendix.md`
- `docs/matching-agent-canonical-files.json`
- `docs/fixtures/matching/**`
- `backend/tests/` contract tests referenced by appendix
- `scripts/validate-matching-fixtures.js`
- Root `package.json` (as `bundle/package-snippet-repo-root.json`, for `npm install`)
- `backend/requirements.txt` (as `bundle/documentation/backend-requirements.txt`)
- `backend/.env.example` (as `documentation/backend-env-example-no-secrets-from-repo.txt`; names only, no secrets)
- `BUNDLE_README.md` → **`bundle/README.md`** (recipient-facing README)
- This handoff `environment-template.md` and `implementation-constraints.md`
