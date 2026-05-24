const http = require("node:http");
const { URL } = require("node:url");
const { matchJobsForResumeAsync } = require("./agents/matchingAgent");
const {
  isPersistenceConfigured,
  isPersistenceEnabled,
  persistMatchRun,
  updateMatchRunTailoringStatus,
} = require("./db/postgres");
const { extractTextFromBase64, extractTextFromBuffer } = require("./io/extractText");
const { buildTailoringConfig, tailorMatchedJobs } = require("./integrations/tailoringClient");
const { openapi } = require("./openapi");

const DEFAULT_PORT = Number(process.env.PORT) || 5051;
const DEFAULT_HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY_BYTES = 15 * 1024 * 1024;

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, statusCode, body) {
  const text = String(body || "");
  res.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(text),
  });
  res.end(text);
}

function parseJsonBuffer(buffer) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (err) {
    const e = new Error("Request body must be valid JSON.");
    e.statusCode = 400;
    e.cause = err;
    throw e;
  }
}

function parseJsonField(rawValue, fieldName) {
  if (rawValue == null || rawValue === "") return null;
  if (typeof rawValue !== "string") return rawValue;
  try {
    return JSON.parse(rawValue);
  } catch (err) {
    const e = new Error(`${fieldName} must be valid JSON.`);
    e.statusCode = 400;
    e.cause = err;
    throw e;
  }
}

function parseOptionalBoolean(value, fieldName) {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;

  const source = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(source)) return true;
  if (["0", "false", "no", "off"].includes(source)) return false;

  const err = new Error(`${fieldName} must be a boolean.`);
  err.statusCode = 400;
  throw err;
}

function requireJobsArray(value) {
  if (!Array.isArray(value) || value.length === 0) {
    const err = new Error("jobs must be a non-empty array.");
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function decodeResumeFilePayload(resumeFile) {
  if (!resumeFile || typeof resumeFile !== "object") {
    const err = new Error("resumeFile must be an object with filename and contentBase64.");
    err.statusCode = 400;
    throw err;
  }

  const filename = String(resumeFile.filename || resumeFile.fileName || "").trim();
  const contentBase64 = String(resumeFile.contentBase64 || "").trim();
  if (!filename || !contentBase64) {
    const err = new Error("resumeFile.filename and resumeFile.contentBase64 are required.");
    err.statusCode = 400;
    throw err;
  }

  return { filename, contentBase64 };
}

function clampTopK(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(numeric)));
}

function clampVectorTopN(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(500, Math.floor(numeric)));
}

function readRequestBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        const err = new Error(`Request body exceeds ${maxBytes} bytes.`);
        err.statusCode = 413;
        reject(err);
        req.destroy(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipartBoundary(contentType) {
  const match = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match ? match[1] || match[2] : "";
}

function parsePartHeaders(headerText) {
  const headers = {};
  for (const line of headerText.split(/\r\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headers;
}

function parseContentDisposition(value) {
  const source = String(value || "");
  const nameMatch = source.match(/name="([^"]+)"/i);
  const fileNameMatch = source.match(/filename="([^"]*)"/i);
  return {
    name: nameMatch ? nameMatch[1] : "",
    filename: fileNameMatch ? fileNameMatch[1] : "",
  };
}

function parseMultipartFormData(body, contentType) {
  const boundaryValue = parseMultipartBoundary(contentType);
  if (!boundaryValue) {
    const err = new Error("Multipart request is missing a boundary.");
    err.statusCode = 400;
    throw err;
  }

  const boundary = Buffer.from(`--${boundaryValue}`);
  const fields = {};
  const files = {};
  let cursor = body.indexOf(boundary);

  while (cursor !== -1) {
    let partStart = cursor + boundary.length;
    const nextTwo = body.slice(partStart, partStart + 2).toString("latin1");
    if (nextTwo === "--") break;
    if (nextTwo === "\r\n") partStart += 2;

    const nextBoundary = body.indexOf(boundary, partStart);
    if (nextBoundary === -1) break;

    let partEnd = nextBoundary;
    if (body.slice(partEnd - 2, partEnd).toString("latin1") === "\r\n") partEnd -= 2;
    const part = body.slice(partStart, partEnd);
    const headerDelimiter = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerDelimiter === -1) {
      cursor = nextBoundary;
      continue;
    }

    const headers = parsePartHeaders(part.slice(0, headerDelimiter).toString("utf8"));
    const content = part.slice(headerDelimiter + 4);
    const disposition = parseContentDisposition(headers["content-disposition"]);
    if (!disposition.name) {
      cursor = nextBoundary;
      continue;
    }

    if (disposition.filename) {
      files[disposition.name] = {
        filename: disposition.filename,
        contentType: headers["content-type"] || "application/octet-stream",
        buffer: content,
      };
    } else {
      fields[disposition.name] = content.toString("utf8");
    }

    cursor = nextBoundary;
  }

  return { fields, files };
}

async function resolveResumeTextFromJson(payload) {
  const resumeText = String(payload.resumeText || "").trim();
  if (resumeText) {
    return {
      resumeText,
      resume: {
        source: "text",
        filename: null,
        extractedLength: resumeText.length,
        resumeId: null,
        candidateName: null,
        resumeVersion: null,
        matchRunId: null,
        persist: null,
      },
    };
  }

  if (payload.resumeFile) {
    const resumeFile = decodeResumeFilePayload(payload.resumeFile);
    const extractedText = String(
      await extractTextFromBase64(resumeFile.contentBase64, resumeFile.filename)
    ).trim();
    if (!extractedText) {
      const err = new Error("resumeFile did not produce any readable text.");
      err.statusCode = 400;
      throw err;
    }

    return {
      resumeText: extractedText,
      resume: {
        source: "file-base64",
        filename: resumeFile.filename,
        extractedLength: extractedText.length,
        resumeId: null,
        candidateName: null,
        resumeVersion: null,
        matchRunId: null,
        persist: null,
      },
    };
  }

  const err = new Error("Provide either resumeText or resumeFile.");
  err.statusCode = 400;
  throw err;
}

async function runJobMatch({ resumeText, resumeMeta, jobs, topK, vectorTopN, skillGroups }) {
  const result = await matchJobsForResumeAsync({
    resumeText,
    jobs,
    topK,
    vectorTopN,
    skillGroups,
  });

  const tailoringConfig = buildTailoringConfig({
    tailoringUrl: resumeMeta.tailoringUrl,
    tailorTopN: resumeMeta.tailorTopN,
    tailorMinScore: resumeMeta.tailorMinScore,
    tailorTimeoutMs: resumeMeta.tailorTimeoutMs,
  });
  const tailoringRequested =
    resumeMeta.tailoringEnabled == null
      ? Boolean(tailoringConfig.tailoringUrl)
      : Boolean(resumeMeta.tailoringEnabled);

  const persistence =
    resumeMeta.persist === false || !isPersistenceEnabled()
      ? {
          enabled: isPersistenceEnabled(),
          saved: false,
          reason:
            resumeMeta.persist === false
              ? "disabled-by-request"
              : isPersistenceConfigured()
                ? "disabled-by-env"
                : "not-configured",
        }
      : await persistMatchRun({
          resumeText,
          resumeMeta,
          inputJobs: jobs,
          result,
          options: {
            resumeId: resumeMeta.resumeId,
            candidateName: resumeMeta.candidateName,
            resumeVersion: resumeMeta.resumeVersion,
            matchRunId: resumeMeta.matchRunId,
            tailoringEnabled: tailoringRequested,
          },
        });

  const syncTailoringStatus = async (tailoringStatus, tailoringError = null) => {
    if (!persistence?.saved || !persistence?.matchRunId) return;
    try {
      await updateMatchRunTailoringStatus({
        matchRunId: persistence.matchRunId,
        tailoringEnabled: tailoringRequested,
        tailoringStatus,
        tailoringError,
      });
    } catch (err) {
      process.stderr.write(
        `failed to update tailoring status for matchRun ${persistence.matchRunId}: ${
          err && err.message ? err.message : String(err)
        }\n`
      );
    }
  };

  let tailoring = {
    enabled: false,
    attempted: 0,
    completed: 0,
    failed: 0,
    jobs: [],
    failures: [],
    status: "not_requested",
  };

  if (tailoringRequested) {
    if (!tailoringConfig.tailoringUrl) {
      const errorMessage = "Tailoring was requested but TAILORING_URL is not configured.";
      tailoring = {
        enabled: true,
        attempted: 0,
        completed: 0,
        failed: 1,
        jobs: [],
        failures: [{ jobId: null, title: null, originalMatchScore: 0, error: errorMessage }],
        status: "failed",
        config: {
          tailoringUrl: "",
          tailorTopN: tailoringConfig.tailorTopN,
          tailorMinScore: tailoringConfig.tailorMinScore,
        },
      };
      await syncTailoringStatus("failed", errorMessage);
    } else {
      try {
        tailoring = await tailorMatchedJobs({
          resumeText,
          candidateName: resumeMeta.candidateName,
          jobs: result.jobs,
          config: tailoringConfig,
        });

        const errorMessage =
          tailoring.failed > 0
            ? (tailoring.failures || [])
                .map((failure) => String(failure?.error || "").trim())
                .filter(Boolean)
                .join(" | ")
            : null;
        await syncTailoringStatus(tailoring.failed > 0 ? "failed" : "completed", errorMessage);
      } catch (err) {
        const errorMessage = err && err.message ? err.message : String(err);
        tailoring = {
          enabled: true,
          attempted: 0,
          completed: 0,
          failed: 1,
          jobs: [],
          failures: [{ jobId: null, title: null, originalMatchScore: 0, error: errorMessage }],
          status: "failed",
          config: {
            tailoringUrl: tailoringConfig.tailoringUrl,
            tailorTopN: tailoringConfig.tailorTopN,
            tailorMinScore: tailoringConfig.tailorMinScore,
          },
        };
        await syncTailoringStatus("failed", errorMessage);
      }
    }
  }

  return {
    ...result,
    resume: resumeMeta,
    persistence,
    tailoring,
    totalJobsReceived: jobs.length,
    totalJobsReturned: result.jobs.length,
  };
}

async function handleJsonMatch(req, res) {
  const body = await readRequestBody(req);
  const payload = parseJsonBuffer(body);
  const jobs = requireJobsArray(payload.jobs);
  const { resumeText, resume } = await resolveResumeTextFromJson(payload);
  const skillGroups = parseJsonField(payload.skillGroups, "skillGroups");

  const response = await runJobMatch({
    resumeText,
    resumeMeta: {
      ...resume,
      resumeId: payload.resumeId || payload.resume_id || null,
      candidateName: payload.candidateName || payload.candidate_name || null,
      resumeVersion: payload.resumeVersion || payload.resume_version || null,
      matchRunId: payload.matchRunId || payload.match_run_id || null,
      tailoringEnabled: parseOptionalBoolean(payload.tailoringEnabled ?? payload.tailoring_enabled, "tailoringEnabled"),
      tailoringUrl: payload.tailoringUrl || payload.tailoring_url || null,
      tailorTopN: payload.tailorTopN ?? payload.tailor_top_n ?? null,
      tailorMinScore: payload.tailorMinScore ?? payload.tailor_min_score ?? null,
      tailorTimeoutMs: payload.tailorTimeoutMs ?? payload.tailor_timeout_ms ?? null,
      persist: parseOptionalBoolean(payload.persist, "persist"),
    },
    jobs,
    topK: clampTopK(payload.topK, 5),
    vectorTopN: clampVectorTopN(payload.vectorTopN || payload.vector_top_n, 100),
    skillGroups,
  });

  sendJson(res, 200, response);
}

async function handleMultipartMatch(req, res) {
  const contentType = String(req.headers["content-type"] || "");
  if (!/^multipart\/form-data/i.test(contentType)) {
    const err = new Error("Content-Type must be multipart/form-data.");
    err.statusCode = 415;
    throw err;
  }

  const body = await readRequestBody(req);
  const form = parseMultipartFormData(body, contentType);
  const file = form.files.file;
  if (!file) {
    const err = new Error("Multipart field 'file' is required.");
    err.statusCode = 400;
    throw err;
  }

  const jobs = requireJobsArray(parseJsonField(form.fields.jobs || form.fields.jobsJson, "jobs"));
  const skillGroups = parseJsonField(form.fields.skillGroups, "skillGroups");
  const resumeText = String(await extractTextFromBuffer(file.buffer, file.filename)).trim();
  if (!resumeText) {
    const err = new Error("Uploaded file did not produce any readable text.");
    err.statusCode = 400;
    throw err;
  }

  const response = await runJobMatch({
    resumeText,
    resumeMeta: {
      source: "multipart-file",
      filename: file.filename,
      extractedLength: resumeText.length,
      resumeId: form.fields.resumeId || form.fields.resume_id || null,
      candidateName: form.fields.candidateName || form.fields.candidate_name || null,
      resumeVersion: form.fields.resumeVersion || form.fields.resume_version || null,
      matchRunId: form.fields.matchRunId || form.fields.match_run_id || null,
      tailoringEnabled: parseOptionalBoolean(form.fields.tailoringEnabled ?? form.fields.tailoring_enabled, "tailoringEnabled"),
      tailoringUrl: form.fields.tailoringUrl || form.fields.tailoring_url || null,
      tailorTopN: form.fields.tailorTopN || form.fields.tailor_top_n || null,
      tailorMinScore: form.fields.tailorMinScore || form.fields.tailor_min_score || null,
      tailorTimeoutMs: form.fields.tailorTimeoutMs || form.fields.tailor_timeout_ms || null,
      persist: parseOptionalBoolean(form.fields.persist, "persist"),
    },
    jobs,
    topK: clampTopK(form.fields.topK, 5),
    vectorTopN: clampVectorTopN(form.fields.vectorTopN || form.fields.vector_top_n, 100),
    skillGroups,
  });

  sendJson(res, 200, response);
}

async function requestHandler(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  const url = new URL(req.url || "/", "http://localhost");

  if (method === "GET" && url.pathname === "/health") {
    const vectorDatabaseConfigured = Boolean(
      String(process.env.VECTOR_DATABASE_URL || process.env.DATABASE_URL || "").trim()
    );
    sendJson(res, 200, {
      ok: true,
      service: "konfigai-resume-bot",
      endpoints: ["/health", "/openapi.json", "/match/jobs", "/match/jobs/upload"],
      persistenceConfigured: isPersistenceConfigured(),
      persistenceEnabled: isPersistenceEnabled(),
      vectorDatabaseConfigured,
    });
    return;
  }

  if (method === "GET" && url.pathname === "/openapi.json") {
    sendJson(res, 200, openapi);
    return;
  }

  if (method === "POST" && url.pathname === "/match/jobs") {
    await handleJsonMatch(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/match/jobs/upload") {
    await handleMultipartMatch(req, res);
    return;
  }

  sendJson(res, 404, {
    error: "Not found",
    path: url.pathname,
  });
}

function createServer() {
  return http.createServer((req, res) => {
    requestHandler(req, res).catch((err) => {
      const statusCode = Number(err && err.statusCode) || 500;
      sendJson(res, statusCode, {
        error: err && err.message ? err.message : "Internal server error",
      });
    });
  });
}

function startServer(port = DEFAULT_PORT, host = DEFAULT_HOST) {
  const server = createServer();
  server.listen(port, host, () => {
    process.stdout.write(`konfigai-resume-bot listening on http://${host}:${port}\n`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  requestHandler,
  startServer,
};
