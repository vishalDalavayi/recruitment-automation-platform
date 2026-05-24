const { Pool } = require("pg");
const {
  buildSourceConfig,
  callMatcher,
  fetchJobs,
  mapSourceResumeRow,
  mapJobsForMatcher,
  requireDatabaseUrl,
} = require("./run-db-match-caller");
const { getPersistenceTableNames, quoteSqlIdentifier } = require("../src/db/postgres");
const { buildTailoringConfig, tailorMatchedJobs } = require("../src/integrations/tailoringClient");

function parseArgs(argv) {
  const out = {
    resumeIds: [],
    resumeLimit: 50,
    jobLimit: 20,
    topK: 5,
    matcherUrl: process.env.MATCHER_URL || "http://127.0.0.1:5051/match/jobs",
    persist: true,
    timeoutMs: 30000,
    force: false,
    date: null,
    tailoringUrl: process.env.TAILORING_URL || "",
    tailorTopN: Number(process.env.TAILOR_TOP_N) || 5,
    tailorMinScore: Number(process.env.TAILOR_MIN_SCORE) || 50,
    tailorTimeoutMs: Number(process.env.TAILOR_TIMEOUT_MS) || 30000,
  };

  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--resume-id") out.resumeIds.push(args[++index]);
    else if (arg === "--resume-limit") out.resumeLimit = Number(args[++index]);
    else if (arg === "--job-limit") out.jobLimit = Number(args[++index]);
    else if (arg === "--topK") out.topK = Number(args[++index]);
    else if (arg === "--matcher-url") out.matcherUrl = args[++index];
    else if (arg === "--persist") out.persist = !["0", "false", "no", "off"].includes(String(args[++index]).toLowerCase());
    else if (arg === "--timeout-ms") out.timeoutMs = Number(args[++index]);
    else if (arg === "--date") out.date = args[++index];
    else if (arg === "--force") out.force = true;
    else if (arg === "--tailor-url") out.tailoringUrl = args[++index];
    else if (arg === "--tailor-top-n") out.tailorTopN = Number(args[++index]);
    else if (arg === "--tailor-min-score") out.tailorMinScore = Number(args[++index]);
    else if (arg === "--tailor-timeout-ms") out.tailorTimeoutMs = Number(args[++index]);
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }

  return out;
}

function usage() {
  return [
    "Usage:",
    "  DATABASE_URL=postgresql://... node scripts/run-daily-match-batch.js [--resume-limit 50] [--job-limit 20] [--topK 5]",
    "",
    "Options:",
    "  --resume-id <id>      Restrict to one or more resume IDs",
    "  --resume-limit <n>    Max resumes to process in this run",
    "  --job-limit <n>       Max candidate jobs fetched per resume",
    "  --topK <n>            Jobs returned/stored per resume",
    "  --date YYYY-MM-DD     Processing day used for once-per-day dedupe (default: today)",
    "  --force               Re-run even if a resume already has a match_run for that day",
    "  --tailor-url <url>    Optional downstream tailoring endpoint",
    "  --tailor-top-n <n>    Tailor at most this many matched jobs per resume (default: 5)",
    "  --tailor-min-score <n> Only tailor matched jobs at or above this matchScore (default: 50)",
    "",
    "Behavior:",
    "  - Reads resumes from the configured source resume table",
    "  - Reads jobs from the configured source job tables",
    "  - Calls the matcher once per resume",
    "  - Skips resumes already processed on that day unless --force is set",
    "  - Optionally calls the downstream tailoring agent for selected top matches",
  ].join("\n");
}

function assertPositiveInteger(value, flagName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
}

function parseDateInput(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("--date must be in YYYY-MM-DD format.");
  }
  return text;
}

function buildDayWindow(dateText) {
  const source = parseDateInput(dateText) || new Date().toISOString().slice(0, 10);
  return {
    dateText: source,
    startIso: `${source}T00:00:00.000Z`,
    endIso: `${source}T23:59:59.999Z`,
  };
}

function pickFirst(values) {
  for (const value of values) {
    const text = String(value == null ? "" : value).trim();
    if (text) return text;
  }
  return "";
}

async function fetchProcessedResumeIds(pool, { startIso, endIso }) {
  const tables = getPersistenceTableNames();
  const result = await pool.query(
    `
      select distinct coalesce(source_resume_ref, resume_id::text) as resume_id
      from ${quoteSqlIdentifier(tables.matchRuns, "match runs table")}
      where created_at >= $1::timestamptz
        and created_at <= $2::timestamptz
    `,
    [startIso, endIso]
  );

  return new Set(result.rows.map((row) => String(row.resume_id || "").trim()).filter(Boolean));
}

async function fetchCandidateResumes(pool, { resumeTable, resumeIds, resumeLimit }) {
  if (resumeIds.length) {
    const result = await pool.query(
      `
        select to_jsonb(t) as row
        from ${resumeTable
          .split(".")
          .map((part) => `"${part}"`)
          .join(".")} t
        where coalesce(
          to_jsonb(t)->>'resume_id',
          to_jsonb(t)->>'id',
          to_jsonb(t)->>'resumeid',
          to_jsonb(t)->>'source_hash',
          to_jsonb(t)->>'unique_id'
        ) = any($1::text[])
          and coalesce(to_jsonb(t)->>'formatted_resume_status', 'completed') = 'completed'
        limit $2
      `,
      [resumeIds, Math.max(resumeLimit, resumeIds.length)]
    );
    return result.rows.map((row) => row.row || {});
  }

  const result = await pool.query(
    `
      select to_jsonb(t) as row
      from ${resumeTable
        .split(".")
        .map((part) => `"${part}"`)
        .join(".")} t
      where coalesce(to_jsonb(t)->>'formatted_resume_status', 'completed') = 'completed'
      order by coalesce(
        to_jsonb(t)->>'formatted_resume_processed_at',
        to_jsonb(t)->>'ingested_at',
        to_jsonb(t)->>'created_at',
        to_jsonb(t)->>'updated_at'
      ) desc nulls last
      limit $1
    `,
    [resumeLimit]
  );
  return result.rows.map((row) => row.row || {});
}

function mapSourceResume(row) {
  const mapped = mapSourceResumeRow(row);
  return {
    resumeId: mapped.resume_id,
    candidateName: mapped.candidate_name,
    resumeText: mapped.formatted_resume_text,
    resumeVersion: mapped.resume_version,
    fileName: mapped.file_name,
  };
}

async function runOneResume({
  resume,
  jobsPool,
  sourceConfig,
  options,
  tailoringConfig,
}) {
  const jobs = await fetchJobs(jobsPool, {
    jobIds: [],
    jobLimit: options.jobLimit,
    jobTables: sourceConfig.jobTables,
  });

  const payload = {
    resumeId: resume.resumeId,
    candidateName: resume.candidateName,
    resumeVersion: resume.resumeVersion,
    resumeText: resume.resumeText,
    jobs: mapJobsForMatcher(jobs),
    topK: options.topK,
    persist: options.persist,
  };

  const response = await callMatcher({
    matcherUrl: options.matcherUrl,
    timeoutMs: options.timeoutMs,
    payload,
  });

  const tailoring = await tailorMatchedJobs({
    resumeText: resume.resumeText,
    candidateName: resume.candidateName,
    jobs: response?.jobs || [],
    config: tailoringConfig,
  });

  return {
    response,
    jobCount: jobs.length,
    tailoring,
  };
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }

  assertPositiveInteger(options.resumeLimit, "--resume-limit");
  assertPositiveInteger(options.jobLimit, "--job-limit");
  assertPositiveInteger(options.topK, "--topK");
  assertPositiveInteger(options.timeoutMs, "--timeout-ms");
  assertPositiveInteger(options.tailorTopN, "--tailor-top-n");
  assertPositiveInteger(options.tailorTimeoutMs, "--tailor-timeout-ms");

  const sourceConfig = buildSourceConfig();
  const dayWindow = buildDayWindow(options.date);
  const tailoringConfig = buildTailoringConfig(options);

  const destinationPool = new Pool({
    connectionString: requireDatabaseUrl(),
    allowExitOnIdle: true,
  });
  const resumePool = new Pool({
    connectionString: sourceConfig.resumeDatabaseUrl,
    allowExitOnIdle: true,
  });
  const jobsPool = new Pool({
    connectionString: sourceConfig.jobsDatabaseUrl,
    allowExitOnIdle: true,
  });

  try {
    const processedResumeIds = options.force
      ? new Set()
      : await fetchProcessedResumeIds(destinationPool, dayWindow);

    const candidates = await fetchCandidateResumes(resumePool, {
      resumeTable: sourceConfig.resumeTable,
      resumeIds: options.resumeIds,
      resumeLimit: options.resumeLimit,
    });

    const resumesToRun = candidates
      .map(mapSourceResume)
      .filter((resume) => resume.resumeId && resume.resumeText)
      .filter((resume) => options.force || !processedResumeIds.has(resume.resumeId));

    console.log(
      `Daily batch date=${dayWindow.dateText} candidates=${candidates.length} queued=${resumesToRun.length} skipped=${
        candidates.length - resumesToRun.length
      }`
    );

    let completed = 0;
    let failed = 0;
    for (const resume of resumesToRun) {
      try {
        console.log(
          `\n[${completed + failed + 1}/${resumesToRun.length}] Matching resume ${resume.resumeId} (${resume.candidateName || resume.fileName || "unknown"})...`
        );
        const result = await runOneResume({
          resume,
          jobsPool,
          sourceConfig,
          options,
          tailoringConfig,
        });
        const persistence = result.response?.persistence || {};
        console.log(
          `Saved matchRunId=${persistence.matchRunId || "n/a"} results=${result.response?.jobs?.length || 0} jobsFetched=${result.jobCount}`
        );
        if (result.tailoring?.enabled) {
          console.log(
            `Tailoring attempted=${result.tailoring.attempted} completed=${result.tailoring.completed} threshold=${result.tailoring.config.tailorMinScore}+ topN=${result.tailoring.config.tailorTopN}`
          );
          for (const tailored of result.tailoring.jobs) {
            console.log(
              `  Tailored ${tailored.title || tailored.jobId || "job"} | original=${tailored.originalMatchScore} | tailored=${
                tailored.tailoredMatchScore == null ? "n/a" : tailored.tailoredMatchScore
              } | model=${tailored.modelUsed || "n/a"}`
            );
          }
        }
        completed += 1;
      } catch (err) {
        failed += 1;
        console.error(
          `Failed resume ${resume.resumeId}: ${err && err.message ? err.message : String(err)}`
        );
      }
    }

    console.log(`\nDaily batch complete: completed=${completed} failed=${failed} date=${dayWindow.dateText}`);
  } finally {
    await Promise.all([destinationPool.end(), resumePool.end(), jobsPool.end()]);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  });
}
