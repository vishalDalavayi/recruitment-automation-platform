const path = require("node:path");
const { Pool } = require("pg");

function pickFirst(values) {
  for (const value of values) {
    const text = String(value == null ? "" : value).trim();
    if (text) return text;
  }
  return "";
}

function parseJsonObject(value) {
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

function pickFromObject(source, keys) {
  if (!source || typeof source !== "object") return "";
  return pickFirst(keys.map((key) => source[key]));
}

function toStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const text = String(value || "").trim();
  if (!text) return [];
  return [text];
}

function appendSection(lines, title, values = []) {
  const items = values.flatMap((value) => toStringList(value));
  if (!items.length) return;
  if (lines.length) lines.push("");
  lines.push(`${title}:`);
  lines.push(...items);
}

function renderExperienceEntry(experience = {}) {
  const lines = [];
  const header = [
    pickFromObject(experience, ["title", "your_title"]),
    pickFromObject(experience, ["Company", "company", "employer"]),
  ]
    .filter(Boolean)
    .join(" - ");
  const detail = [
    pickFromObject(experience, ["location", "Location"]),
    pickFromObject(experience, ["dates_of_employment", "dates", "date_range"]),
  ]
    .filter(Boolean)
    .join(" | ");
  const heading = [header, detail].filter(Boolean).join(" | ");
  if (heading) lines.push(heading);

  const projectDescription = pickFromObject(experience, [
    "project_description",
    "description",
    "summary",
  ]);
  if (projectDescription) lines.push(projectDescription);

  const responsibilities = toStringList(
    experience.Responsibilities || experience.responsibilities || experience.project_responsibilities
  );
  if (responsibilities.length) {
    lines.push("Responsibilities:");
    lines.push(...responsibilities.map((item) => `- ${item}`));
  }

  const environment = toStringList(
    experience.Environment || experience.environment || experience.Technologies_used || experience.technologies_used
  );
  if (environment.length) {
    lines.push(`Environment: ${environment.join(", ")}`);
  }

  return lines.filter(Boolean);
}

function renderAcademicEntry(academic = {}) {
  const line = [
    pickFromObject(academic, ["Degree", "degree"]),
    pickFromObject(academic, ["Major", "major"]),
    pickFromObject(academic, ["University", "university", "school"]),
  ]
    .filter(Boolean)
    .join(" - ");
  return line ? [line] : [];
}

function renderTechnicalSkills(skills) {
  const source = parseJsonObject(skills);
  if (!source) return [];
  const lines = [];
  for (const [category, rawValues] of Object.entries(source)) {
    const values = toStringList(rawValues);
    if (!String(category || "").trim() || !values.length) continue;
    lines.push(`${String(category).trim()}: ${values.join(", ")}`);
  }
  return lines;
}

function renderFormattedResumeContent(content) {
  const source = parseJsonObject(content);
  if (!source) return "";

  const lines = [];
  const candidateName = pickFromObject(source, ["Name", "name"]);
  if (candidateName) lines.push(candidateName);

  const contactLine = [
    pickFromObject(source, ["Phone", "phone"]),
    pickFromObject(source, ["Email", "email"]),
  ]
    .filter(Boolean)
    .join(" | ");
  if (contactLine) lines.push(contactLine);

  appendSection(lines, "SUMMARY", [pickFromObject(source, ["Summary", "summary"])]);
  appendSection(
    lines,
    "ACADEMICS",
    (source.Academics || source.academics || []).flatMap((item) => renderAcademicEntry(item))
  );
  appendSection(lines, "TECHNICAL SKILLS", renderTechnicalSkills(source.Technical_Skills || source.technical_skills));
  appendSection(
    lines,
    "PROFESSIONAL EXPERIENCE",
    (source.Professional_Experience || source.professional_experience || []).flatMap((item) =>
      renderExperienceEntry(item)
    )
  );
  appendSection(
    lines,
    "ACADEMIC PROJECTS",
    (source.Academic_projects || source.academic_projects || []).flatMap((item) => renderExperienceEntry(item))
  );
  appendSection(lines, "CERTIFICATIONS", source.certifications || source.Certifications || []);

  return lines.join("\n").trim();
}

function mapSourceResumeRow(row, requestedResumeId = "") {
  const formattedContent = parseJsonObject(row.formatted_resume_content);
  const formattedResumeText = pickFirst([
    row.formatted_resume_text,
    row.full_text,
    row.resume_text,
    row.text,
    row.content,
    renderFormattedResumeContent(formattedContent),
  ]);
  const candidateName = pickFirst([
    row.candidate_name,
    row.name,
    row.candidate,
    row.full_name,
    formattedContent?.Name,
    formattedContent?.name,
  ]);
  const fileName = pickFirst([
    row.file_name,
    row.filename,
    row.formatted_resume_path ? path.basename(String(row.formatted_resume_path)) : "",
  ]);

  return {
    resume_id: pickFirst([row.resume_id, row.id, row.resumeid, row.source_hash, row.unique_id]) || String(requestedResumeId),
    source_resume_ref: pickFirst([row.source_resume_ref, row.source_hash, row.unique_id]),
    candidate_name: candidateName,
    formatted_resume_text: formattedResumeText,
    resume_version: pickFirst([
      row.resume_version,
      row.file_type,
      row.version,
      row.formatted_resume_status,
      row.formatted_resume_processed_at ? "formatted-resume-content" : "",
    ]),
    file_name: fileName,
    formatted_resume_status: pickFirst([row.formatted_resume_status]),
  };
}

function parseCsvList(value, fallback) {
  const list = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
}

function assertSqlIdentifier(value, label) {
  const source = String(value || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(source)) {
    throw new Error(`${label} must be a simple SQL identifier like table_name or schema.table_name.`);
  }
  return source;
}

function quoteIdentifier(value) {
  return assertSqlIdentifier(value, "SQL identifier")
    .split(".")
    .map((part) => `"${part}"`)
    .join(".");
}

function parseArgs(argv) {
  const out = {
    jobIds: [],
    jobLimit: 20,
    topK: 5,
    matcherUrl: process.env.MATCHER_URL || "http://127.0.0.1:5051/match/jobs",
    persist: true,
    timeoutMs: 30000,
  };

  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--resume-id") out.resumeId = args[++index];
    else if (arg === "--job-id") out.jobIds.push(args[++index]);
    else if (arg === "--job-limit") out.jobLimit = Number(args[++index]);
    else if (arg === "--topK") out.topK = Number(args[++index]);
    else if (arg === "--matcher-url") out.matcherUrl = args[++index];
    else if (arg === "--persist") out.persist = !["0", "false", "no", "off"].includes(String(args[++index]).toLowerCase());
    else if (arg === "--timeout-ms") out.timeoutMs = Number(args[++index]);
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }

  return out;
}

function usage() {
  return [
    "Usage:",
    "  DATABASE_URL=postgresql://... node scripts/run-db-match-caller.js --resume-id <uuid> [--job-id <uuid> ...] [--job-limit 20] [--topK 5] [--matcher-url http://127.0.0.1:5051/match/jobs]",
    "",
    "Optional source env vars:",
    "  - SOURCE_DATABASE_URL / SOURCE_RESUME_DATABASE_URL / SOURCE_JOBS_DATABASE_URL",
    "  - SOURCE_RESUME_TABLE (default: candidate_details.formatting_resume_info)",
    "  - SOURCE_JOBS_TABLES (default: scrapped_data.active_scraped_data,scrapped_data.inactive_scraped_data)",
    "",
    "Notes:",
    "  - --resume-id is required.",
    "  - If no --job-id values are supplied, the script fetches the latest jobs from the configured source tables, limited by --job-limit.",
    "  - This script is the reference upstream caller: it reads stored DB rows and calls the matcher over HTTP.",
  ].join("\n");
}

function requireDatabaseUrl() {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the DB-backed caller.");
  }
  return databaseUrl;
}

function buildSourceConfig() {
  const primaryDatabaseUrl = requireDatabaseUrl();
  const sourceDatabaseUrl = String(process.env.SOURCE_DATABASE_URL || "").trim() || primaryDatabaseUrl;
  const resumeDatabaseUrl =
    String(process.env.SOURCE_RESUME_DATABASE_URL || "").trim() || sourceDatabaseUrl;
  const jobsDatabaseUrl =
    String(process.env.SOURCE_JOBS_DATABASE_URL || "").trim() || sourceDatabaseUrl;
  const resumeTable = assertSqlIdentifier(
    String(process.env.SOURCE_RESUME_TABLE || "candidate_details.formatting_resume_info").trim(),
    "SOURCE_RESUME_TABLE"
  );
  const jobTables = parseCsvList(process.env.SOURCE_JOBS_TABLES, [
    "scrapped_data.active_scraped_data",
    "scrapped_data.inactive_scraped_data",
  ]).map((tableName) => assertSqlIdentifier(tableName, "SOURCE_JOBS_TABLES"));

  return {
    resumeDatabaseUrl,
    jobsDatabaseUrl,
    resumeTable,
    jobTables,
  };
}

function assertPositiveInteger(value, flagName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
}

async function fetchResume(pool, resumeId, resumeTable) {
  const result = await pool.query(
    `
      select to_jsonb(t) as row
      from ${quoteIdentifier(resumeTable)} t
      where coalesce(
        to_jsonb(t)->>'resume_id',
        to_jsonb(t)->>'id',
        to_jsonb(t)->>'resumeid',
        to_jsonb(t)->>'source_hash',
        to_jsonb(t)->>'unique_id'
      ) = $1::text
      limit 1
    `,
    [resumeId]
  );

  if (!result.rows.length) {
    throw new Error(`No resume found for resume_id=${resumeId}`);
  }

  const row = result.rows[0].row || {};
  const mapped = mapSourceResumeRow(row, resumeId);

  if (mapped.formatted_resume_status && mapped.formatted_resume_status !== "completed") {
    throw new Error(
      `Resume ${resumeId} was found in ${resumeTable}, but formatting status is '${mapped.formatted_resume_status}' instead of 'completed'.`
    );
  }

  if (!mapped.formatted_resume_text) {
    throw new Error(
      `Resume ${resumeId} was found in ${resumeTable}, but no text column matched formatted_resume_text/full_text/resume_text/text/content or formatted_resume_content.`
    );
  }

  return mapped;
}

function mapSourceJobRow(row, tableName) {
  const source = row?.row || row || {};
  return {
    id: pickFirst([
      source.job_id,
      source.id,
      source.jobid,
      source.external_id,
      source.uuid,
      source.serial_no ? `${tableName}:${source.serial_no}` : "",
    ]),
    source: pickFirst([source.source, source.publisher, source.source_publisher, source.board_name]),
    title: pickFirst([source.title, source.job_title, source.position, source.role]),
    company_name: pickFirst([source.company_name, source.company, source.employer_name, source.client_name]),
    location: pickFirst([source.location, source.job_location, source.candidate_required_location, source.city]),
    url: pickFirst([source.url, source.job_url, source.apply_url, source.job_link, source.link]),
    job_type: pickFirst([source.job_type, source.employment_type, source.workplace_type]),
    salary: pickFirst([source.salary, source.salary_range, source.compensation]),
    publication_date: pickFirst([source.publication_date, source.posted_date, source.posted_at, source.date_posted]),
    description_html: pickFirst([
      source.description_html,
      source.job_description_html,
      source.html,
      source.raw_html,
    ]),
    description_text: pickFirst([
      source.description_text,
      source.description,
      source.job_description,
      source.full_text,
      source.job_text,
    ]),
    normalized_jd_text: pickFirst([
      source.normalized_jd_text,
      source.normalized_jd,
      source.normalized_job_description,
      source.tabner_job_description,
    ]),
    requirements_json:
      source.requirements_json && typeof source.requirements_json === "object"
        ? source.requirements_json
        : source.requirements && typeof source.requirements === "object"
          ? source.requirements
          : null,
    serial_no: pickFirst([source.serial_no]),
    source_job_ref: pickFirst([source.job_id, source.id, source.jobid, source.external_id, source.uuid, source.serial_no]),
    source_table: tableName,
    _sourceTable: tableName,
    _sortTimestamp: pickFirst([
      source.scraped_at,
      source.created_at,
      source.updated_at,
      source.posted_at,
      source.date_posted,
      source.publication_date,
    ]),
  };
}

function dedupeAndTrimJobs(rows, jobLimit) {
  const mapped = rows
    .map((row) => mapSourceJobRow(row.row || row, row._sourceTable || "jobs"))
    .filter((job) => job.id || job.url || job.title || job.description_text || job.description_html);

  mapped.sort((a, b) => {
    const left = Date.parse(a._sortTimestamp || "") || 0;
    const right = Date.parse(b._sortTimestamp || "") || 0;
    return right - left;
  });

  const seen = new Set();
  const deduped = [];
  for (const job of mapped) {
    const key = pickFirst([
      job.id,
      job.url,
      `${job.title}|${job.company_name}|${job.location}|${job._sourceTable}`,
    ]);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(job);
    if (deduped.length >= jobLimit) break;
  }

  return deduped;
}

async function fetchJobsFromTable(pool, tableName, { jobIds, jobLimit }) {
  const quoted = quoteIdentifier(tableName);
  if (jobIds.length) {
    const result = await pool.query(
      `
        select to_jsonb(t) as row
        from ${quoted} t
        where coalesce(
          to_jsonb(t)->>'job_id',
          to_jsonb(t)->>'id',
          to_jsonb(t)->>'jobid',
          to_jsonb(t)->>'external_id',
          to_jsonb(t)->>'uuid'
        ) = any($1::text[])
        limit $2
      `,
      [jobIds, Math.max(jobIds.length, jobLimit)]
    );
    return result.rows.map((row) => ({ ...row, _sourceTable: tableName }));
  }

  const result = await pool.query(
    `
      select to_jsonb(t) as row
      from ${quoted} t
      order by coalesce(
        to_jsonb(t)->>'scraped_at',
        to_jsonb(t)->>'created_at',
        to_jsonb(t)->>'updated_at',
        to_jsonb(t)->>'posted_at',
        to_jsonb(t)->>'date_posted',
        to_jsonb(t)->>'publication_date'
      ) desc nulls last
      limit $1
    `,
    [jobLimit]
  );
  return result.rows.map((row) => ({ ...row, _sourceTable: tableName }));
}

async function fetchJobs(pool, { jobIds, jobLimit, jobTables }) {
  const rows = (
    await Promise.all(
      jobTables.map((tableName) => fetchJobsFromTable(pool, tableName, { jobIds, jobLimit }))
    )
  ).flat();

  const jobs = dedupeAndTrimJobs(rows, jobLimit);
  if (!jobs.length) {
    throw new Error(`No jobs found in configured source tables: ${jobTables.join(", ")}`);
  }
  return jobs;
}

function mapJobsForMatcher(rows) {
  return rows.map((row) => ({
    id: row.job_id || row.id,
    source: row.source,
    title: row.title,
    company_name: row.company_name,
    location: row.location,
    url: row.url,
    job_type: row.job_type,
    salary: row.salary,
    publication_date: row.publication_date,
    description_html: row.description_html,
    description_text: row.description_text,
    normalized_jd_text: row.normalized_jd_text,
    requirements_json: row.requirements_json,
  }));
}

async function callMatcher({ matcherUrl, timeoutMs, payload }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(matcherUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    let parsedBody = null;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch (_err) {
      parsedBody = bodyText;
    }

    if (!response.ok) {
      throw new Error(
        `Matcher request failed with ${response.status} ${response.statusText}: ${
          typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody)
        }`
      );
    }

    return parsedBody;
  } finally {
    clearTimeout(timer);
  }
}

function printSummary(response) {
  const persistence = response?.persistence || {};
  const jobs = Array.isArray(response?.jobs) ? response.jobs : [];

  console.log(`matchRunId: ${persistence.matchRunId || "n/a"}`);
  console.log(`persistence.saved: ${String(Boolean(persistence.saved))}`);
  console.log(`jobs returned: ${jobs.length}`);
  console.log("");

  jobs.forEach((job, index) => {
    console.log(
      `${index + 1}. ${job.title || "Untitled"} @ ${job.company || "Unknown"} | score=${
        job.matchScore
      } | ats=${job.atsScore} | eligible=${job.eligible}`
    );
  });
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }

  if (!options.resumeId) throw new Error("--resume-id is required.");
  assertPositiveInteger(options.jobLimit, "--job-limit");
  assertPositiveInteger(options.topK, "--topK");
  assertPositiveInteger(options.timeoutMs, "--timeout-ms");

  const sourceConfig = buildSourceConfig();

  const resumePool = new Pool({
    connectionString: sourceConfig.resumeDatabaseUrl,
    allowExitOnIdle: true,
  });
  const jobsPool = new Pool({
    connectionString: sourceConfig.jobsDatabaseUrl,
    allowExitOnIdle: true,
  });

  try {
    const resume = await fetchResume(resumePool, options.resumeId, sourceConfig.resumeTable);
    const jobs = await fetchJobs(jobsPool, {
      jobIds: options.jobIds,
      jobLimit: options.jobLimit,
      jobTables: sourceConfig.jobTables,
    });

    const payload = {
      // Preserve the upstream/source identifier when available so matcher persistence
      // upserts the existing resume row instead of colliding on the internal UUID.
      resumeId: resume.source_resume_ref || resume.resume_id,
      candidateName: resume.candidate_name,
      resumeVersion: resume.resume_version,
      resumeText: resume.formatted_resume_text,
      jobs: mapJobsForMatcher(jobs),
      topK: options.topK,
      persist: options.persist,
    };

    console.log(
      `Calling matcher at ${options.matcherUrl} with resume ${resume.resume_id} and ${payload.jobs.length} jobs from ${sourceConfig.jobTables.join(", ")}...`
    );
    const response = await callMatcher({
      matcherUrl: options.matcherUrl,
      timeoutMs: options.timeoutMs,
      payload,
    });

    printSummary(response);
  } finally {
    await Promise.all([resumePool.end(), jobsPool.end()]);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  });
}

module.exports = {
  buildSourceConfig,
  callMatcher,
  fetchJobs,
  fetchResume,
  mapJobsForMatcher,
  printSummary,
  requireDatabaseUrl,
  mapSourceResumeRow,
  renderFormattedResumeContent,
};
