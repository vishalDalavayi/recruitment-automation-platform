const { createHash, randomUUID } = require("node:crypto");

function parseBooleanEnv(value) {
  const source = String(value == null ? "" : value).trim().toLowerCase();
  if (!source) return null;
  if (["1", "true", "yes", "on"].includes(source)) return true;
  if (["0", "false", "no", "off"].includes(source)) return false;
  return null;
}

function assertSqlIdentifier(value, label) {
  const source = String(value || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(source)) {
    throw new Error(`${label} must be a simple SQL identifier like table_name or schema.table_name.`);
  }
  return source;
}

function quoteSqlIdentifier(value, label = "SQL identifier") {
  return assertSqlIdentifier(value, label)
    .split(".")
    .map((part) => `"${part}"`)
    .join(".");
}

function getQualifiedTableName(envName, fallback) {
  return assertSqlIdentifier(process.env[envName] || fallback, envName);
}

function extractSchemaName(identifier) {
  const parts = assertSqlIdentifier(identifier, "SQL identifier").split(".");
  return parts.length === 2 ? parts[0] : null;
}

function getPersistenceTableNames() {
  return {
    resumes: getQualifiedTableName("MATCH_RESUMES_TABLE", "candidate_details.candidate_match_resumes"),
    jobs: getQualifiedTableName("MATCH_JOBS_TABLE", "candidate_details.candidate_match_jobs"),
    matchRuns: getQualifiedTableName("MATCH_RUNS_TABLE", "candidate_details.candidate_match_runs"),
    matchResults: getQualifiedTableName("MATCH_RESULTS_TABLE", "candidate_details.candidate_match_results"),
  };
}

function getConnectionConfig() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (connectionString) return { connectionString };

  const host = String(process.env.PGHOST || "").trim();
  if (!host) return null;

  const config = {
    host,
    port: Number(process.env.PGPORT) || 5432,
    database: String(process.env.PGDATABASE || "").trim() || undefined,
    user: String(process.env.PGUSER || "").trim() || undefined,
    password: String(process.env.PGPASSWORD || "").trim() || undefined,
  };

  return config;
}

function isPersistenceConfigured() {
  return Boolean(getConnectionConfig());
}

function isPersistenceEnabled() {
  const explicit = parseBooleanEnv(process.env.MATCH_PERSISTENCE_ENABLED);
  if (explicit != null) return explicit;
  return isPersistenceConfigured();
}

function isPersistenceAutoSetupEnabled() {
  const explicit = parseBooleanEnv(process.env.MATCH_PERSISTENCE_AUTO_SETUP);
  if (explicit != null) return explicit;
  return true;
}

let pool = null;
let persistenceSchemaReady = false;

function getPool() {
  if (!isPersistenceEnabled()) return null;
  if (pool) return pool;

  let Pool;
  try {
    ({ Pool } = require("pg"));
  } catch (err) {
    const error = new Error(
      "Postgres persistence is configured, but the 'pg' package is not installed. Run 'npm install pg'."
    );
    error.cause = err;
    throw error;
  }

  pool = new Pool({
    ...getConnectionConfig(),
    allowExitOnIdle: true,
  });
  pool.on("error", (err) => {
    process.stderr.write(`postgres pool error: ${err.message}\n`);
  });
  return pool;
}

async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  persistenceSchemaReady = false;
  await current.end();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function formatUuidFromBytes(buffer) {
  const hex = Buffer.from(buffer).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function stableUuidFromText(value) {
  const hash = createHash("sha256").update(String(value || "")).digest().subarray(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return formatUuidFromBytes(hash);
}

function normalizeRequestedUuid(value, fallbackKey) {
  const text = String(value || "").trim();
  if (isUuid(text)) return text.toLowerCase();
  if (text) return stableUuidFromText(fallbackKey ? `${fallbackKey}:${text}` : text);
  return fallbackKey ? stableUuidFromText(fallbackKey) : randomUUID();
}

function stableHash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function parseObjectField(value) {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (_err) {
    return null;
  }
}

function pickFirstDefined(values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function buildResumeId({ resumeId, resumeText, resumeMeta, candidateName }) {
  const sourceResumeRef = String(resumeId || "").trim();
  if (sourceResumeRef) {
    if (isUuid(sourceResumeRef)) return sourceResumeRef.toLowerCase();
    return stableUuidFromText(`source-resume:${sourceResumeRef}`);
  }

  return normalizeRequestedUuid(
    null,
    `resume:${resumeMeta?.filename || ""}:${candidateName || ""}:${stableHash(resumeText)}`
  );
}

function buildJobLookupKeys(job, index) {
  const keys = [
    job?.id,
    job?.job_id,
    job?.url,
    job?.job_url,
    job?.apply_url,
    job?.normalizedJobDescription,
    job?.normalized_jd_text,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const source = String(job?.source || job?.publisher || job?.source_publisher || "").trim();
  const title = String(job?.title || job?.job_title || job?.position || "").trim();
  const company = String(job?.company || job?.company_name || job?.employer_name || "").trim();
  if (source || title || company) keys.push(`${source}|${title}|${company}`);
  keys.push(`index:${index}`);
  return Array.from(new Set(keys));
}

function buildJobSourceIndex(jobs) {
  const byKey = new Map();
  (Array.isArray(jobs) ? jobs : []).forEach((job, index) => {
    for (const key of buildJobLookupKeys(job, index)) {
      if (!byKey.has(key)) byKey.set(key, job);
    }
  });
  return byKey;
}

function findSourceJob(resultJob, index, byKey) {
  for (const key of buildJobLookupKeys(resultJob, index)) {
    if (byKey.has(key)) return byKey.get(key);
  }
  return null;
}

function buildPersistedJobId(job, sourceJob, index) {
  const explicit = pickFirstDefined([
    sourceJob?.persistedJobId,
    sourceJob?.persisted_job_id,
    sourceJob?.jobId,
    sourceJob?.job_id,
    job?.persistedJobId,
    job?.jobId,
  ]);
  const fingerprint = pickFirstDefined([
    sourceJob?.id,
    sourceJob?.job_key,
    sourceJob?.url,
    sourceJob?.job_url,
    sourceJob?.apply_url,
    job?.id,
    job?.url,
    `${job?.source || sourceJob?.source || ""}|${job?.title || sourceJob?.title || ""}|${
      job?.company || sourceJob?.company_name || sourceJob?.company || ""
    }|${index}`,
  ]);
  return normalizeRequestedUuid(explicit, `job:${fingerprint}`);
}

function resolveJobRequirements(job, sourceJob) {
  const provided = parseObjectField(
    pickFirstDefined([
      sourceJob?.requirements,
      sourceJob?.requirements_json,
      sourceJob?.requirementsJson,
      job?.requirements,
      job?.requirements_json,
    ])
  );
  if (provided) return provided;

  try {
    const { extractJobRequirements } = require("../agents/matchingAgent");
    return extractJobRequirements(String(job?.normalizedJobDescription || ""));
  } catch (_err) {
    return null;
  }
}

function jsonValue(value) {
  return value == null ? null : JSON.stringify(value);
}

function coercePersistedScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
}

function normalizeTailoringStatus(value, fallback = "not_requested") {
  const source = String(value || "").trim().toLowerCase();
  if (!source) return fallback;
  if (["not_requested", "pending", "completed", "failed", "disabled"].includes(source)) {
    return source;
  }
  throw new Error(`Invalid tailoring status '${value}'.`);
}
async function ensurePersistenceSchema(client) {
  if (persistenceSchemaReady || !isPersistenceAutoSetupEnabled()) return;

  const tables = getPersistenceTableNames();
  const schemaNames = new Set(
    Object.values(tables)
      .map((identifier) => extractSchemaName(identifier))
      .filter(Boolean)
  );

  for (const schemaName of schemaNames) {
    await client.query(`create schema if not exists ${quoteSqlIdentifier(schemaName, "schema name")}`);
  }

  await client.query(
    `
      create table if not exists ${quoteSqlIdentifier(tables.resumes, "match resumes table")} (
        resume_id uuid primary key,
        source_resume_ref text,
        candidate_name text,
        formatted_resume_text text not null,
        resume_version text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.resumes, "match resumes table")} add column if not exists source_resume_ref text`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.resumes, "match resumes table")} add column if not exists created_at timestamptz not null default now()`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.resumes, "match resumes table")} add column if not exists updated_at timestamptz not null default now()`
  );
  await client.query(
    `create unique index if not exists candidate_match_resumes_source_resume_ref_idx on ${quoteSqlIdentifier(
      tables.resumes,
      "match resumes table"
    )} (source_resume_ref)`
  );

  await client.query(
    `
      create table if not exists ${quoteSqlIdentifier(tables.jobs, "match jobs table")} (
        job_id uuid primary key,
        source_job_ref text,
        source_table text,
        source text,
        title text,
        company_name text,
        location text,
        url text,
        description_html text,
        description_text text,
        normalized_jd_text text,
        requirements_json jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.jobs, "match jobs table")} add column if not exists source_job_ref text`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.jobs, "match jobs table")} add column if not exists source_table text`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.jobs, "match jobs table")} add column if not exists created_at timestamptz not null default now()`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.jobs, "match jobs table")} add column if not exists updated_at timestamptz not null default now()`
  );
  await client.query(
    `create index if not exists candidate_match_jobs_source_job_ref_idx on ${quoteSqlIdentifier(
      tables.jobs,
      "match jobs table"
    )} (source_job_ref)`
  );

  await client.query(
    `
      create table if not exists ${quoteSqlIdentifier(tables.matchRuns, "match runs table")} (
        match_run_id uuid primary key,
        resume_id uuid not null references ${quoteSqlIdentifier(tables.resumes, "match resumes table")} (resume_id) on delete cascade,
        source_resume_ref text,
        matcher_version text,
        top_k integer,
        tailoring_enabled boolean not null default false,
        tailoring_status text not null default 'not_requested',
        tailoring_error text,
        tailoring_completed_at timestamptz,
        updated_at timestamptz not null default now(),
        created_at timestamptz not null default now()
      )
    `
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.matchRuns, "match runs table")} add column if not exists source_resume_ref text`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.matchRuns, "match runs table")} add column if not exists tailoring_enabled boolean not null default false`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.matchRuns, "match runs table")} add column if not exists tailoring_status text not null default 'not_requested'`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.matchRuns, "match runs table")} add column if not exists tailoring_error text`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.matchRuns, "match runs table")} add column if not exists tailoring_completed_at timestamptz`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.matchRuns, "match runs table")} add column if not exists updated_at timestamptz not null default now()`
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.matchRuns, "match runs table")} add column if not exists created_at timestamptz not null default now()`
  );
  await client.query(
    `create index if not exists candidate_match_runs_source_resume_ref_idx on ${quoteSqlIdentifier(
      tables.matchRuns,
      "match runs table"
    )} (source_resume_ref, created_at desc)`
  );

  await client.query(
    `
      create table if not exists ${quoteSqlIdentifier(tables.matchResults, "match results table")} (
        match_run_id uuid not null references ${quoteSqlIdentifier(
          tables.matchRuns,
          "match runs table"
        )} (match_run_id) on delete cascade,
        job_id uuid not null references ${quoteSqlIdentifier(tables.jobs, "match jobs table")} (job_id) on delete cascade,
        rank integer not null,
        match_score numeric(6, 2) not null default 0,
        ats_score numeric(6, 2) not null default 0,
        eligible boolean not null default false,
        summary text,
        strengths_json jsonb,
        gaps_json jsonb,
        tailoring_hints_json jsonb,
        breakdown_json jsonb,
        created_at timestamptz not null default now(),
        primary key (match_run_id, job_id)
      )
    `
  );
  await client.query(
    `alter table ${quoteSqlIdentifier(tables.matchResults, "match results table")} add column if not exists created_at timestamptz not null default now()`
  );
  await client.query(
    `create index if not exists candidate_match_results_rank_idx on ${quoteSqlIdentifier(
      tables.matchResults,
      "match results table"
    )} (match_run_id, rank)`
  );

  persistenceSchemaReady = true;
}

async function persistMatchRun({
  resumeText,
  resumeMeta,
  inputJobs,
  result,
  options = {},
} = {}) {
  if (!isPersistenceEnabled()) {
    return {
      enabled: false,
      saved: false,
      reason: "persistence-disabled",
    };
  }

  const dbPool = getPool();
  const client = await dbPool.connect();
  const resumeId = buildResumeId({
    resumeId: options.resumeId,
    resumeText,
    resumeMeta,
    candidateName: options.candidateName,
  });
  const matchRunId = normalizeRequestedUuid(options.matchRunId, `match-run:${resumeId}:${Date.now()}:${randomUUID()}`);
  const sourceIndex = buildJobSourceIndex(inputJobs);
  const tables = getPersistenceTableNames();
  const sourceResumeRef = String(options.resumeId || "").trim() || null;
  const tailoringEnabled = Boolean(options.tailoringEnabled);
  const tailoringStatus = normalizeTailoringStatus(
    options.tailoringStatus,
    tailoringEnabled ? "pending" : "not_requested"
  );
  const tailoringCompletedAt = tailoringStatus === "completed" ? new Date().toISOString() : null;

  try {
    await ensurePersistenceSchema(client);
    await client.query("BEGIN");

    const resumeUpsertQuery = sourceResumeRef
      ? `
        insert into ${quoteSqlIdentifier(tables.resumes, "match resumes table")} (
          resume_id,
          source_resume_ref,
          candidate_name,
          formatted_resume_text,
          resume_version,
          updated_at
        )
        values ($1::uuid, $2, $3, $4, $5, now())
        on conflict (source_resume_ref) do update
          set candidate_name = coalesce(excluded.candidate_name, ${quoteSqlIdentifier(
            tables.resumes,
            "match resumes table"
          )}.candidate_name),
              formatted_resume_text = excluded.formatted_resume_text,
              resume_version = coalesce(excluded.resume_version, ${quoteSqlIdentifier(
                tables.resumes,
                "match resumes table"
              )}.resume_version),
              updated_at = now()
        returning resume_id
      `
      : `
        insert into ${quoteSqlIdentifier(tables.resumes, "match resumes table")} (
          resume_id,
          source_resume_ref,
          candidate_name,
          formatted_resume_text,
          resume_version,
          updated_at
        )
        values ($1::uuid, $2, $3, $4, $5, now())
        on conflict (resume_id) do update
          set source_resume_ref = coalesce(excluded.source_resume_ref, ${quoteSqlIdentifier(
            tables.resumes,
            "match resumes table"
          )}.source_resume_ref),
              candidate_name = coalesce(excluded.candidate_name, ${quoteSqlIdentifier(
                tables.resumes,
                "match resumes table"
              )}.candidate_name),
              formatted_resume_text = excluded.formatted_resume_text,
              resume_version = coalesce(excluded.resume_version, ${quoteSqlIdentifier(
                tables.resumes,
                "match resumes table"
              )}.resume_version),
              updated_at = now()
        returning resume_id
      `;

    const resumeUpsertResult = await client.query(resumeUpsertQuery, [
      resumeId,
      sourceResumeRef,
      options.candidateName || null,
      String(resumeText || ""),
      options.resumeVersion || null,
    ]);
    const persistedResumeId = String(resumeUpsertResult.rows?.[0]?.resume_id || resumeId);

    await client.query(
      `
        insert into ${quoteSqlIdentifier(tables.matchRuns, "match runs table")} (
          match_run_id,
          resume_id,
          source_resume_ref,
          matcher_version,
          top_k,
          tailoring_enabled,
          tailoring_status,
          tailoring_error,
          tailoring_completed_at,
          updated_at
        )
        values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::timestamptz, now())
      `,
      [
        matchRunId,
        persistedResumeId,
        sourceResumeRef,
        String(result?.method || "pharmaiq-ats-core-v1"),
        Number(result?.topK) || null,
        tailoringEnabled,
        tailoringStatus,
        null,
        tailoringCompletedAt,
      ]
    );

    const jobs = Array.isArray(result?.jobs) ? result.jobs : [];
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      const sourceJob = findSourceJob(job, index, sourceIndex);
      const persistedJobId = buildPersistedJobId(job, sourceJob, index);
      const requirements = resolveJobRequirements(job, sourceJob);

      await client.query(
        `
          insert into ${quoteSqlIdentifier(tables.jobs, "match jobs table")} (
            job_id,
            source_job_ref,
            source_table,
            source,
            title,
            company_name,
            location,
            url,
            description_html,
            description_text,
            normalized_jd_text,
            requirements_json
          )
          values (
            $1::uuid,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12::jsonb
          )
          on conflict (job_id) do update
            set source_job_ref = coalesce(excluded.source_job_ref, ${quoteSqlIdentifier(
              tables.jobs,
              "match jobs table"
            )}.source_job_ref),
                source_table = coalesce(excluded.source_table, ${quoteSqlIdentifier(
                  tables.jobs,
                  "match jobs table"
                )}.source_table),
                normalized_jd_text = coalesce(excluded.normalized_jd_text, ${quoteSqlIdentifier(
                  tables.jobs,
                  "match jobs table"
                )}.normalized_jd_text),
                requirements_json = coalesce(excluded.requirements_json, ${quoteSqlIdentifier(
                  tables.jobs,
                  "match jobs table"
                )}.requirements_json),
                updated_at = now()
        `,
        [
          persistedJobId,
          pickFirstDefined([
            sourceJob?.source_job_ref,
            sourceJob?.source_job_id,
            sourceJob?.serial_no,
            sourceJob?.id,
            job?.id,
          ]),
          pickFirstDefined([sourceJob?._sourceTable, sourceJob?.source_table]),
          pickFirstDefined([job?.source, sourceJob?.source, sourceJob?.publisher, sourceJob?.source_publisher]),
          pickFirstDefined([job?.title, sourceJob?.title, sourceJob?.job_title, sourceJob?.position]),
          pickFirstDefined([job?.company, sourceJob?.company_name, sourceJob?.company, sourceJob?.employer_name]),
          pickFirstDefined([job?.location, sourceJob?.location, sourceJob?.job_location]),
          pickFirstDefined([job?.url, sourceJob?.url, sourceJob?.job_url, sourceJob?.apply_url]),
          pickFirstDefined([sourceJob?.description_html]),
          pickFirstDefined([job?.descriptionText, sourceJob?.description_text, sourceJob?.description]),
          String(job?.normalizedJobDescription || ""),
          jsonValue(requirements),
        ]
      );

      await client.query(
        `
          insert into ${quoteSqlIdentifier(tables.matchResults, "match results table")} (
            match_run_id,
            job_id,
            rank,
            match_score,
            ats_score,
            eligible,
            summary,
            strengths_json,
            gaps_json,
            tailoring_hints_json,
            breakdown_json
          )
          values (
            $1::uuid,
            $2::uuid,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8::jsonb,
            $9::jsonb,
            $10::jsonb,
            $11::jsonb
          )
          on conflict (match_run_id, job_id) do update
            set rank = excluded.rank,
                match_score = excluded.match_score,
                ats_score = excluded.ats_score,
                eligible = excluded.eligible,
                summary = excluded.summary,
                strengths_json = excluded.strengths_json,
                gaps_json = excluded.gaps_json,
                tailoring_hints_json = excluded.tailoring_hints_json,
                breakdown_json = excluded.breakdown_json
        `,
        [
          matchRunId,
          persistedJobId,
          index + 1,
          coercePersistedScore(job?.matchScore),
          coercePersistedScore(job?.atsScore),
          Boolean(job?.eligible),
          String(job?.summary || ""),
          jsonValue(job?.strengths || []),
          jsonValue(job?.gaps || []),
          jsonValue(job?.tailoringHints || []),
          jsonValue(job?.breakdown || {}),
        ]
      );
    }

    await client.query("COMMIT");

    return {
      enabled: true,
      saved: true,
      resumeId,
      matchRunId,
      savedResults: jobs.length,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateMatchRunTailoringStatus({
  matchRunId,
  tailoringEnabled = null,
  tailoringStatus,
  tailoringError = null,
} = {}) {
  if (!isPersistenceEnabled()) {
    return {
      enabled: false,
      updated: false,
      reason: "persistence-disabled",
    };
  }

  const normalizedMatchRunId = String(matchRunId || "").trim();
  if (!normalizedMatchRunId) {
    throw new Error("matchRunId is required.");
  }

  const normalizedStatus = normalizeTailoringStatus(tailoringStatus);
  const dbPool = getPool();
  const client = await dbPool.connect();
  const tables = getPersistenceTableNames();

  try {
    await ensurePersistenceSchema(client);
    const result = await client.query(
      `
        update ${quoteSqlIdentifier(tables.matchRuns, "match runs table")}
        set tailoring_enabled = coalesce($2::boolean, tailoring_enabled),
            tailoring_status = $3,
            tailoring_error = $4,
            tailoring_completed_at = case when $3 = 'completed' then now() else null end,
            updated_at = now()
        where match_run_id = $1::uuid
      `,
      [
        normalizedMatchRunId,
        tailoringEnabled == null ? null : Boolean(tailoringEnabled),
        normalizedStatus,
        tailoringError ? String(tailoringError) : null,
      ]
    );

    return {
      enabled: true,
      updated: result.rowCount > 0,
      matchRunId: normalizedMatchRunId,
      tailoringStatus: normalizedStatus,
    };
  } finally {
    client.release();
  }
}

module.exports = {
  closePool,
  ensurePersistenceSchema,
  getPool,
  isPersistenceConfigured,
  isPersistenceEnabled,
  getPersistenceTableNames,
  quoteSqlIdentifier,
  persistMatchRun,
  stableUuidFromText,
  updateMatchRunTailoringStatus,
};
