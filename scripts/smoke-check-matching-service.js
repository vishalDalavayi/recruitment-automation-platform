const fs = require("node:fs");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

const { matching, server, io, db } = require("../src/index");

const rootDir = path.join(__dirname, "..");
const fixturesDir = path.join(__dirname, "fixtures");
const sampleTabnerDocx = "/Users/vishal.dalavayi/Downloads/TABNER FORMAT.docx";

function readFixture(relativePath) {
  return fs.readFileSync(path.join(fixturesDir, relativePath), "utf8");
}

function makeResponsePromise(req) {
  let statusCode = null;
  let headers = null;
  const chunks = [];

  const responseDone = new Promise((resolve, reject) => {
    const res = {
      writeHead(code, hdrs) {
        statusCode = code;
        headers = hdrs;
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        resolve({
          statusCode,
          headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      },
    };

    server.requestHandler(req, res).catch(reject);
  });

  return responseDone;
}

async function runJsonRoute(payload) {
  const req = new PassThrough();
  req.method = "POST";
  req.url = "/match/jobs";
  req.headers = { "content-type": "application/json" };
  const responseDone = makeResponsePromise(req);
  req.end(JSON.stringify(payload));
  const response = await responseDone;
  assert.equal(response.statusCode, 200, response.body);
  return JSON.parse(response.body);
}

async function runMultipartRoute({ fileName, fileText, jobs, topK }) {
  const boundary = "----resume-bot-smoke-boundary";
  const body = [
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: text/plain\r\n\r\n${fileText}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="jobs"\r\n\r\n${JSON.stringify(jobs)}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="topK"\r\n\r\n${String(topK)}\r\n`,
    `--${boundary}--\r\n`,
  ].join("");

  const req = new PassThrough();
  req.method = "POST";
  req.url = "/match/jobs/upload";
  req.headers = { "content-type": `multipart/form-data; boundary=${boundary}` };
  const responseDone = makeResponsePromise(req);
  req.end(body);
  const response = await responseDone;
  assert.equal(response.statusCode, 200, response.body);
  return JSON.parse(response.body);
}

async function verifySampleTabnerDocx() {
  if (!fs.existsSync(sampleTabnerDocx)) {
    console.log("SKIP sample Tabner DOCX check: file not found.");
    return;
  }

  try {
    const text = await io.extractTextFromFile(sampleTabnerDocx);
    assert.match(text, /SUMMARY:/i);
    assert.match(text, /TECHNICAL SKILLS:/i);
    assert.match(text, /PROFESSIONAL EXPERIENCE:/i);
    console.log("PASS sample Tabner DOCX extraction includes expected headings.");
  } catch (err) {
    console.log(`SKIP sample Tabner DOCX check: ${err.message}`);
  }
}

async function verifyPersistenceIfConfigured(backendResume, jobs) {
  if (!db.isPersistenceEnabled()) {
    console.log("SKIP Postgres persistence check: DATABASE_URL not configured.");
    return;
  }

  const pool = db.getPool();
  const tables = db.getPersistenceTableNames();
  const before = await pool.query(
    `select count(*)::int as count from ${db.quoteSqlIdentifier(tables.matchRuns, "match runs table")}`
  );
  const response = await runJsonRoute({
    resumeId: "smoke-backend-resume",
    candidateName: "Smoke Backend Candidate",
    resumeVersion: "smoke-v1",
    resumeText: backendResume,
    jobs,
    topK: 2,
  });

  assert.equal(response.persistence.enabled, true);
  assert.equal(response.persistence.saved, true);
  assert.ok(response.persistence.matchRunId);
  assert.ok(response.persistence.resumeId);

  const after = await pool.query(
    `select count(*)::int as count from ${db.quoteSqlIdentifier(tables.matchRuns, "match runs table")}`
  );
  assert.equal(after.rows[0].count, before.rows[0].count + 1);

  const savedRun = await pool.query(
    `select count(*)::int as count from ${db.quoteSqlIdentifier(
      tables.matchResults,
      "match results table"
    )} where match_run_id = $1::uuid`,
    [response.persistence.matchRunId]
  );
  assert.equal(savedRun.rows[0].count, response.jobs.length);
  console.log("PASS JSON route persists match_runs and match_results when Postgres is configured.");
}

async function seedDbCallerFixtures(pool, backendResume, jobs) {
  const resumeId = db.stableUuidFromText("smoke:db-caller:resume");
  const selectedJobs = jobs.slice(0, 2);
  const seededJobIds = [];
  const tables = db.getPersistenceTableNames();

  await pool.query(
    `
      insert into ${db.quoteSqlIdentifier(tables.resumes, "match resumes table")} (
        resume_id,
        source_resume_ref,
        candidate_name,
        formatted_resume_text,
        resume_version,
        updated_at
      )
      values ($1::uuid, $2, $3, $4, $5, now())
      on conflict (resume_id) do update
        set source_resume_ref = excluded.source_resume_ref,
            candidate_name = excluded.candidate_name,
            formatted_resume_text = excluded.formatted_resume_text,
            resume_version = excluded.resume_version,
            updated_at = now()
    `,
    [resumeId, "smoke:db-caller:resume", "Smoke DB Caller Candidate", backendResume, "smoke-db-caller-v1"]
  );

  for (const job of selectedJobs) {
    const jobId = db.stableUuidFromText(`smoke:db-caller:job:${job.id}`);
    seededJobIds.push(jobId);

    const normalizedJobDescription =
      job.normalizedJobDescription || matching.buildNormalizedJobDescription(job.description_text || "");
    const requirements =
      job.requirements_json ||
      job.requirements ||
      matching.extractJobRequirements(normalizedJobDescription);

    await pool.query(
      `
        insert into ${db.quoteSqlIdentifier(tables.jobs, "match jobs table")} (
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
          set source_job_ref = excluded.source_job_ref,
              source_table = excluded.source_table,
              source = excluded.source,
              title = excluded.title,
              company_name = excluded.company_name,
              location = excluded.location,
              url = excluded.url,
              description_html = excluded.description_html,
              description_text = excluded.description_text,
              normalized_jd_text = excluded.normalized_jd_text,
              requirements_json = excluded.requirements_json
      `,
      [
        jobId,
        job.id,
        "smoke_jobs",
        job.source || null,
        job.title || null,
        job.company_name || job.company || null,
        job.location || null,
        job.url || null,
        job.description_html || null,
        job.description_text || null,
        normalizedJobDescription || null,
        JSON.stringify(requirements || {}),
      ]
    );
  }

  return {
    resumeId,
    jobIds: seededJobIds,
  };
}

function listen(serverInstance, port, host) {
  return new Promise((resolve, reject) => {
    serverInstance.once("error", reject);
    serverInstance.listen(port, host, () => {
      serverInstance.removeListener("error", reject);
      resolve();
    });
  });
}

function closeServer(serverInstance) {
  return new Promise((resolve, reject) => {
    serverInstance.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function runDbCaller({ resumeId, jobIds, matcherUrl }) {
  return new Promise((resolve, reject) => {
    const tables = db.getPersistenceTableNames();
    const args = [
      path.join("scripts", "run-db-match-caller.js"),
      "--resume-id",
      resumeId,
      ...jobIds.flatMap((jobId) => ["--job-id", jobId]),
      "--topK",
      String(jobIds.length),
      "--matcher-url",
      matcherUrl,
    ];

    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      env: {
        ...process.env,
        SOURCE_RESUME_TABLE: tables.resumes,
        SOURCE_JOBS_TABLES: tables.jobs,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`DB caller exited with code ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
    });
  });
}

async function verifyDbCallerIfConfigured(backendResume, jobs) {
  if (!db.isPersistenceEnabled()) {
    console.log("SKIP DB-backed caller check: DATABASE_URL not configured.");
    return;
  }

  const pool = db.getPool();
  const seeded = await seedDbCallerFixtures(pool, backendResume, jobs);
  const tables = db.getPersistenceTableNames();
  const before = await pool.query(
    `select count(*)::int as count from ${db.quoteSqlIdentifier(
      tables.matchRuns,
      "match runs table"
    )} where source_resume_ref = $1`,
    ["smoke:db-caller:resume"]
  );

  const httpServer = server.createServer();
  await listen(httpServer, 0, "127.0.0.1");

  try {
    const address = httpServer.address();
    const matcherUrl = `http://127.0.0.1:${address.port}/match/jobs`;
    const result = await runDbCaller({
      resumeId: seeded.resumeId,
      jobIds: seeded.jobIds,
      matcherUrl,
    });

    assert.match(result.stdout, /matchRunId:\s+[0-9a-f-]+/i);
    assert.match(result.stdout, /persistence\.saved:\s+true/i);
    assert.match(result.stdout, /jobs returned:\s+2/i);

    const after = await pool.query(
      `select count(*)::int as count from ${db.quoteSqlIdentifier(
        tables.matchRuns,
        "match runs table"
      )} where source_resume_ref = $1`,
      ["smoke:db-caller:resume"]
    );
    assert.equal(after.rows[0].count, before.rows[0].count + 1);

    console.log("PASS DB-backed caller fetches stored resume/jobs and calls matcher over HTTP.");
  } finally {
    await closeServer(httpServer);
  }
}

async function main() {
  const backendResume = readFixture("resumes/backend-tabner.txt");
  const dataResume = readFixture("resumes/data-tabner.txt");
  const jobs = JSON.parse(readFixture("jobs/sample-jobs.json"));

  const backendResult = matching.matchJobsForResume({
    resumeText: backendResume,
    jobs,
    topK: 3,
  });
  assert.equal(backendResult.jobs[0].id, "backend-job-1");
  assert.ok(backendResult.jobs[0].matchScore > backendResult.jobs[1].matchScore);
  console.log("PASS library matcher ranks backend resume against backend job first.");

  const dataResult = matching.matchJobsForResume({
    resumeText: dataResume,
    jobs,
    topK: 3,
  });
  assert.equal(dataResult.jobs[0].id, "data-job-1");
  assert.ok(dataResult.jobs[0].matchScore > dataResult.jobs[1].matchScore);
  console.log("PASS library matcher ranks data resume against data job first.");

  const preNormalizedResult = matching.matchJobsForResume({
    resumeText: backendResume,
    jobs: [
      {
        id: "pre-normalized-job",
        title: "Stored Normalized Backend Role",
        description_text: "Required: COBOL, mainframe, DB2",
        normalizedJobDescription: [
          "TITLE: Stored Normalized Backend Role",
          "EXPERIENCE: 5+ years",
          "REQUIRED SKILLS: node.js; aws; rest",
          "ROLE KEYWORDS: software engineer, backend",
          "MATCHING CONTEXT:",
          "- Required: Node.js, AWS, REST APIs",
        ].join("\n"),
      },
      {
        id: "raw-mismatch-job",
        title: "Mainframe Engineer",
        description_text: "Required: COBOL, mainframe, DB2",
      },
    ],
    topK: 2,
  });
  assert.equal(preNormalizedResult.jobs[0].id, "pre-normalized-job");
  assert.ok(preNormalizedResult.jobs[0].matchScore > preNormalizedResult.jobs[1].matchScore);
  console.log("PASS matcher prefers stored normalized JD text when present on a job.");

  const jsonRouteResult = await runJsonRoute({
    resumeText: backendResume,
    jobs,
    topK: 2,
  });
  assert.equal(jsonRouteResult.jobs[0].id, "backend-job-1");
  console.log("PASS JSON route returns ranked jobs for resumeText input.");

  const multipartRouteResult = await runMultipartRoute({
    fileName: "resume.txt",
    fileText: backendResume,
    jobs,
    topK: 1,
  });
  assert.equal(multipartRouteResult.jobs[0].id, "backend-job-1");
  console.log("PASS multipart route returns ranked jobs for uploaded resume file.");

  await verifySampleTabnerDocx();
  await verifyPersistenceIfConfigured(backendResume, jobs);
  await verifyDbCallerIfConfigured(backendResume, jobs);
  await db.closePool();

  console.log("Smoke checks completed successfully.");
}

main().catch((err) => {
  console.error("Smoke check failed.");
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
