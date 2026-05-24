const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const {
  buildNormalizedJobDescription: buildCoreNormalizedJobDescription,
  buildTailoringHints,
  extractJobRequirements,
  extractResumeProfile,
} = require("./atsCore");
const { normalizeJobPosting } = require("./jobPosting");

function getVectorDatabaseUrl() {
  return String(process.env.VECTOR_DATABASE_URL || process.env.DATABASE_URL || "").trim();
}

const DEFAULT_CHILD_TIMEOUT_MS = 2 * 60 * 1000;
const DEFAULT_MAX_CONCURRENCY = 4;
let activeMatcherJobs = 0;
const matcherQueue = [];

function clampTopK(value, fallback, maxValue) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(maxValue, Math.floor(numeric)));
}

function clampVectorTopN(value, fallback, maxValue) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(maxValue, Math.floor(numeric)));
}

function buildNormalizedJobBundle(jobDescription) {
  return buildCoreNormalizedJobDescription(String(jobDescription || ""));
}

function normalizeJobDescription(jobDescription) {
  return buildNormalizedJobBundle(jobDescription).normalizedText;
}

function getPythonBin() {
  if (process.env.MATCHER_PYTHON_BIN) {
    return process.env.MATCHER_PYTHON_BIN;
  }

  const candidates = [
    path.join(process.cwd(), ".venv-compare", "bin", "python3"),
    path.join(process.cwd(), ".venv311", "bin", "python3"),
    path.join(process.cwd(), ".venv", "bin", "python3"),
    "python3",
    "python",
  ];

  for (const candidate of candidates) {
    if (candidate === "python3" || candidate === "python" || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python3";
}

function getMatcherChildTimeoutMs() {
  const numeric = Number(process.env.MATCHER_CHILD_TIMEOUT_MS);
  if (!Number.isFinite(numeric) || numeric < 1000) return DEFAULT_CHILD_TIMEOUT_MS;
  return Math.floor(numeric);
}

function getMatcherMaxConcurrency() {
  const numeric = Number(process.env.MATCHER_MAX_CONCURRENCY);
  if (!Number.isFinite(numeric) || numeric < 1) return DEFAULT_MAX_CONCURRENCY;
  return Math.floor(numeric);
}

function scheduleMatcherJob(runJob) {
  return new Promise((resolve, reject) => {
    const startJob = () => {
      activeMatcherJobs += 1;
      Promise.resolve()
        .then(runJob)
        .then(resolve, reject)
        .finally(() => {
          activeMatcherJobs = Math.max(0, activeMatcherJobs - 1);
          const next = matcherQueue.shift();
          if (next) next();
        });
    };

    if (activeMatcherJobs < getMatcherMaxConcurrency()) {
      startJob();
      return;
    }

    matcherQueue.push(startJob);
  });
}

function stableJobVectorKey(job, index) {
  const explicit = String(job.id || "").trim();
  if (explicit) return explicit;

  const fingerprint = [
    String(job.url || "").trim(),
    String(job.title || "").trim(),
    String(job.company || job.company_name || "").trim(),
    String(job.location || "").trim(),
    String(job.partnerJobDescription || job.descriptionText || job.normalizedJobDescription || "").trim(),
    String(index + 1),
  ].join("|");

  return `job-${createHash("sha256").update(fingerprint).digest("hex").slice(0, 24)}`;
}

function buildTailoringHintsFromKeywords(missingKeywords = []) {
  if (!Array.isArray(missingKeywords) || !missingKeywords.length) return [];
  return [
    `If the resume already supports these ideas, surface them more explicitly for ATS matching: ${missingKeywords
      .slice(0, 8)
      .join(", ")}.`,
  ];
}

function buildPartnerVectorMatcherPayload({ resumeText, jobs, topK, vectorTopN }) {
  return {
    resume_text: String(resumeText || ""),
    top_k: clampTopK(topK, 5, 100),
    vector_top_n: clampVectorTopN(vectorTopN, 50, 500),
    database_url: getVectorDatabaseUrl(),
    pgvector_table: process.env.PGVECTOR_TABLE || "candidate_details.job_vector_embeddings",
    pgvector_auto_setup: String(process.env.PGVECTOR_AUTO_SETUP || "true"),
    embedding_model: process.env.EMBEDDING_MODEL || "all-MiniLM-L6-v2",
    jobs: (Array.isArray(jobs) ? jobs : []).map((job, index) => ({
      id: String(job.id || stableJobVectorKey(job, index)),
      title: String(job.title || ""),
      company_name: String(job.company || job.company_name || ""),
      location: String(job.location || ""),
      url: String(job.url || ""),
      source: String(job.source || ""),
      jobType: String(job.jobType || ""),
      salary: String(job.salary || ""),
      publicationDate: String(job.publicationDate || ""),
      job_description: String(job.partnerJobDescription || job.descriptionText || job.normalizedJobDescription || ""),
    })),
  };
}

function getMatcherProcessOptions(payload) {
  return {
    cwd: process.cwd(),
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: getMatcherChildTimeoutMs(),
    env: {
      ...process.env,
      HF_HOME: process.env.HF_HOME || path.join(process.cwd(), ".hf-cache"),
    },
  };
}

function parsePartnerVectorMatcherResult(result) {
  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const error = new Error(
      [
        "Partner vector matcher failed.",
        String(result.stderr || result.stdout || `exit=${result.status}`),
      ].join("\n")
    );
    error.statusCode = 500;
    throw error;
  }

  return JSON.parse(result.stdout || "{}");
}

function runPartnerVectorMatcher({ resumeText, jobs, topK, vectorTopN }) {
  const payload = buildPartnerVectorMatcherPayload({ resumeText, jobs, topK, vectorTopN });
  const result = spawnSync(getPythonBin(), [path.join(process.cwd(), "scripts", "vector_rank_jobs.py")], {
    ...getMatcherProcessOptions(payload),
  });

  return parsePartnerVectorMatcherResult(result);
}

function runPartnerVectorMatcherAsync({ resumeText, jobs, topK, vectorTopN }) {
  const payload = buildPartnerVectorMatcherPayload({ resumeText, jobs, topK, vectorTopN });
  const timeoutMs = getMatcherChildTimeoutMs();

  return scheduleMatcherJob(
    () =>
      new Promise((resolve, reject) => {
        const child = spawn(
          getPythonBin(),
          [path.join(process.cwd(), "scripts", "vector_rank_jobs.py")],
          {
            cwd: process.cwd(),
            env: getMatcherProcessOptions(payload).env,
            stdio: ["pipe", "pipe", "pipe"],
          }
        );

        const stdout = [];
        const stderr = [];
        let settled = false;
        let timedOut = false;

        const finishWithError = (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        };

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeoutMs);

        child.stdout.on("data", (chunk) => {
          stdout.push(chunk);
        });

        child.stderr.on("data", (chunk) => {
          stderr.push(chunk);
        });

        child.on("error", (error) => {
          clearTimeout(timer);
          finishWithError(error);
        });

        child.on("close", (status, signal) => {
          clearTimeout(timer);
          if (settled) return;
          if (timedOut) {
            const error = new Error(`Partner vector matcher timed out after ${timeoutMs}ms.`);
            error.statusCode = 504;
            finishWithError(error);
            return;
          }

          try {
            settled = true;
            resolve(
              parsePartnerVectorMatcherResult({
                status,
                signal,
                stdout: Buffer.concat(stdout).toString("utf8"),
                stderr: Buffer.concat(stderr).toString("utf8"),
              })
            );
          } catch (error) {
            reject(error);
          }
        });

        child.stdin.on("error", (error) => {
          clearTimeout(timer);
          finishWithError(error);
        });
        child.stdin.end(JSON.stringify(payload));
      })
  );
}

function prepareJobs(jobs = []) {
  return (Array.isArray(jobs) ? jobs : []).map((job) => {
    const normalized = normalizeJobPosting(job);
    const partnerJobDescription = String(
      normalized.providedNormalizedJobDescription || normalized.descriptionText || normalized.normalizedJobDescription || ""
    );
    const normalizedJob = buildNormalizedJobBundle(normalized.normalizedJobDescription || normalized.descriptionText || "");
    return {
      ...normalized,
      partnerJobDescription,
      normalizedJobDescription: normalizedJob.normalizedText,
      requirements: normalized.precomputedRequirements || extractJobRequirements(normalizedJob.normalizedText),
    };
  });
}

function buildEvaluationFromPartnerResult(job, partnerResult, resumeProfile) {
  const matchedKeywords = Array.isArray(partnerResult?.matched_keywords) ? partnerResult.matched_keywords : [];
  const missingKeywords = Array.isArray(partnerResult?.missing_keywords) ? partnerResult.missing_keywords : [];
  const keywordScore = Number(partnerResult?.keyword_score || 0);
  const tfidfScore = Number(partnerResult?.tfidf_score || 0);
  const retrievalSimilarity = Number(partnerResult?.retrieval_similarity || 0);
  const finalScore = Number(partnerResult?.final_score || 0);
  const retrievalBackend = String(partnerResult?.retrieval_backend || "vector");
  const scoringMethod = String(
    partnerResult?.scoring_method ||
      (retrievalBackend === "memory" ? "partner-keyword-tfidf+memory-vector-v1" : "partner-keyword-tfidf+pgvector-v1")
  );

  return {
    matchScore: finalScore,
    atsScore: finalScore,
    eligible: true,
    summary: `score uses partner-style weighting: 60% keyword overlap + 40% TF-IDF after ${retrievalBackend} vector retrieval`,
    strengths: matchedKeywords.length ? [`Matched keywords: ${matchedKeywords.slice(0, 10).join(", ")}`] : [],
    gaps: missingKeywords.length ? [`Missing JD keywords: ${missingKeywords.slice(0, 10).join(", ")}`] : [],
    tailoringHints: buildTailoringHintsFromKeywords(missingKeywords),
    breakdown: {
      scoringMethod,
      keywordScore,
      tfidfScore,
      retrievalSimilarity,
      matchedKeywords,
      missingKeywords,
      weights: {
        keywordOverlap: 0.6,
        tfidfCosine: 0.4,
      },
      vectorRetrieval: {
        db: retrievalBackend,
        similarity: retrievalSimilarity,
      },
      requirements: job.requirements || null,
      resumeProfile: resumeProfile || null,
    },
  };
}

function buildAtsEvaluation({
  jobDescription,
  resumeText,
  retrievalScore = null,
  precomputedRequirements = null,
} = {}) {
  const normalized = buildNormalizedJobBundle(jobDescription);
  const resumeProfile = extractResumeProfile(String(resumeText || ""));
  const job = {
    id: "job-1",
    title: null,
    company: null,
    location: null,
    url: null,
    source: null,
    jobType: null,
    salary: null,
    publicationDate: null,
    partnerJobDescription: String(jobDescription || ""),
    descriptionText: String(jobDescription || ""),
    normalizedJobDescription: normalized.normalizedText,
    requirements: precomputedRequirements || normalized.requirements,
  };

  const ranked = runPartnerVectorMatcher({
    resumeText,
    jobs: [job],
    topK: 1,
    vectorTopN: 1,
  });
  const partnerResult = Array.isArray(ranked.jobs) ? ranked.jobs[0] : null;
  const evaluation = buildEvaluationFromPartnerResult(
    { ...job, requirements: precomputedRequirements || normalized.requirements },
    {
      ...partnerResult,
      retrieval_similarity: retrievalScore == null ? partnerResult?.retrieval_similarity : retrievalScore,
    },
    resumeProfile
  );

  return {
    ...evaluation,
    normalizedJobDescription: normalized.normalizedText,
    requirements: precomputedRequirements || normalized.requirements,
    tailoringHints: buildTailoringHints(evaluation) || evaluation.tailoringHints,
  };
}

function matchCandidates({
  jobDescription,
  candidates,
  topK = 5,
} = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const safeTopK = clampTopK(topK, 5, 50);
  const normalizedBundle = buildNormalizedJobBundle(jobDescription);

  const evaluated = list.map((candidate) => {
    const evaluation = buildAtsEvaluation({
      jobDescription: normalizedBundle.normalizedText,
      resumeText: String(candidate?.resumeText || ""),
      precomputedRequirements: normalizedBundle.requirements,
    });

    return {
      id: candidate?.id || null,
      name: candidate?.name || null,
      matchScore: evaluation.matchScore,
      atsScore: evaluation.atsScore,
      eligible: evaluation.eligible,
      summary: evaluation.summary,
      strengths: evaluation.strengths,
      gaps: evaluation.gaps,
      tailoringHints: evaluation.tailoringHints,
      breakdown: evaluation.breakdown,
      resumeText: candidate?.resumeText || "",
    };
  });

  const ranked = evaluated
    .slice()
    .sort(
      (a, b) =>
        (b.matchScore || 0) - (a.matchScore || 0) ||
        String(a.name || "").localeCompare(String(b.name || ""))
    );
  const scoringMethod =
    ranked[0]?.breakdown?.scoringMethod ||
    evaluated[0]?.breakdown?.scoringMethod ||
    "partner-keyword-tfidf+pgvector-v1";

  return {
    method: scoringMethod,
    topK: safeTopK,
    normalizedJobDescription: normalizedBundle.normalizedText,
    requirements: normalizedBundle.requirements,
    candidates: ranked.slice(0, safeTopK),
  };
}

function matchJobsForResume({
  resumeText,
  jobs,
  topK = 5,
  vectorTopN = null,
} = {}) {
  const safeTopK = clampTopK(topK, 5, 100);
  const preparedJobs = prepareJobs(jobs);
  const resumeProfile = extractResumeProfile(String(resumeText || ""));
  const retrievalTopN = clampVectorTopN(
    vectorTopN != null ? vectorTopN : process.env.MATCH_VECTOR_TOP_N,
    Math.min(Math.max(safeTopK, 50), Math.max(preparedJobs.length, safeTopK)),
    Math.max(preparedJobs.length || safeTopK, safeTopK)
  );

  const ranked = runPartnerVectorMatcher({
    resumeText,
    jobs: preparedJobs,
    topK: safeTopK,
    vectorTopN: retrievalTopN,
  });

  const byId = new Map(preparedJobs.map((job) => [String(job.id), job]));
  const jobsOut = (Array.isArray(ranked.jobs) ? ranked.jobs : []).map((partnerJob, index) => {
    const source = byId.get(String(partnerJob.id)) || preparedJobs[index] || {};
    const evaluation = buildEvaluationFromPartnerResult(source, partnerJob, resumeProfile);
    return {
      id: source.id || partnerJob.id || `job-${index + 1}`,
      title: source.title || partnerJob.title || null,
      company: source.company || source.company_name || partnerJob.company_name || null,
      location: source.location || partnerJob.location || null,
      url: source.url || partnerJob.url || null,
      source: source.source || partnerJob.source || null,
      jobType: source.jobType || partnerJob.jobType || null,
      salary: source.salary || partnerJob.salary || null,
      publicationDate: source.publicationDate || partnerJob.publicationDate || null,
      descriptionText: source.descriptionText || partnerJob.job_description || "",
      normalizedJobDescription: source.normalizedJobDescription || partnerJob.job_description || "",
      matchScore: evaluation.matchScore,
      atsScore: evaluation.atsScore,
      eligible: evaluation.eligible,
      summary: evaluation.summary,
      strengths: evaluation.strengths,
      gaps: evaluation.gaps,
      tailoringHints: evaluation.tailoringHints,
      breakdown: {
        ...evaluation.breakdown,
        requirements: source.requirements || null,
      },
    };
  });

  return {
    method: String(
      ranked.method || (String(ranked.vector_backend || "") === "memory"
        ? "partner-keyword-tfidf+memory-vector-v1"
        : "partner-keyword-tfidf+pgvector-v1")
    ),
    vectorBackend: String(ranked.vector_backend || (process.env.VECTOR_DATABASE_URL || process.env.DATABASE_URL ? "pgvector" : "memory")),
    topK: safeTopK,
    vectorTopN: retrievalTopN,
    totalJobsConsidered: preparedJobs.length,
    totalJobsRetrieved: Number(ranked.jobs_retrieved || jobsOut.length),
    embeddingModel: ranked.embedding_model || process.env.EMBEDDING_MODEL || "all-MiniLM-L6-v2",
    jobs: jobsOut,
  };
}

async function matchJobsForResumeAsync({
  resumeText,
  jobs,
  topK = 5,
  vectorTopN = null,
} = {}) {
  const safeTopK = clampTopK(topK, 5, 100);
  const preparedJobs = prepareJobs(jobs);
  const resumeProfile = extractResumeProfile(String(resumeText || ""));
  const retrievalTopN = clampVectorTopN(
    vectorTopN != null ? vectorTopN : process.env.MATCH_VECTOR_TOP_N,
    Math.min(Math.max(safeTopK, 50), Math.max(preparedJobs.length, safeTopK)),
    Math.max(preparedJobs.length || safeTopK, safeTopK)
  );

  const ranked = await runPartnerVectorMatcherAsync({
    resumeText,
    jobs: preparedJobs,
    topK: safeTopK,
    vectorTopN: retrievalTopN,
  });

  const byId = new Map(preparedJobs.map((job) => [String(job.id), job]));
  const jobsOut = (Array.isArray(ranked.jobs) ? ranked.jobs : []).map((partnerJob, index) => {
    const source = byId.get(String(partnerJob.id)) || preparedJobs[index] || {};
    const evaluation = buildEvaluationFromPartnerResult(source, partnerJob, resumeProfile);
    return {
      id: source.id || partnerJob.id || `job-${index + 1}`,
      title: source.title || partnerJob.title || null,
      company: source.company || source.company_name || partnerJob.company_name || null,
      location: source.location || partnerJob.location || null,
      url: source.url || partnerJob.url || null,
      source: source.source || partnerJob.source || null,
      jobType: source.jobType || partnerJob.jobType || null,
      salary: source.salary || partnerJob.salary || null,
      publicationDate: source.publicationDate || partnerJob.publicationDate || null,
      descriptionText: source.descriptionText || partnerJob.job_description || "",
      normalizedJobDescription: source.normalizedJobDescription || partnerJob.job_description || "",
      matchScore: evaluation.matchScore,
      atsScore: evaluation.atsScore,
      eligible: evaluation.eligible,
      summary: evaluation.summary,
      strengths: evaluation.strengths,
      gaps: evaluation.gaps,
      tailoringHints: evaluation.tailoringHints,
      breakdown: {
        ...evaluation.breakdown,
        requirements: source.requirements || null,
      },
    };
  });

  return {
    method: String(
      ranked.method || (String(ranked.vector_backend || "") === "memory"
        ? "partner-keyword-tfidf+memory-vector-v1"
        : "partner-keyword-tfidf+pgvector-v1")
    ),
    vectorBackend: String(ranked.vector_backend || (process.env.VECTOR_DATABASE_URL || process.env.DATABASE_URL ? "pgvector" : "memory")),
    topK: safeTopK,
    vectorTopN: retrievalTopN,
    totalJobsConsidered: preparedJobs.length,
    totalJobsRetrieved: Number(ranked.jobs_retrieved || jobsOut.length),
    embeddingModel: ranked.embedding_model || process.env.EMBEDDING_MODEL || "all-MiniLM-L6-v2",
    jobs: jobsOut,
  };
}

module.exports = {
  buildAtsEvaluation,
  buildNormalizedJobDescription: normalizeJobDescription,
  buildTailoringHints,
  extractJobRequirements,
  extractResumeProfile,
  matchCandidates,
  matchJobsForResume,
  matchJobsForResumeAsync,
};
