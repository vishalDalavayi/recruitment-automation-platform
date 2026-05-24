function clampNumber(value, fallback, minValue = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (minValue != null && numeric < minValue) return fallback;
  return numeric;
}

function buildTailoringConfig(source = {}) {
  const tailoringUrl = String(source.tailoringUrl || process.env.TAILORING_URL || "").trim();
  return {
    tailoringUrl,
    tailorTopN: clampNumber(source.tailorTopN || process.env.TAILOR_TOP_N, 5, 1),
    tailorMinScore: clampNumber(source.tailorMinScore || process.env.TAILOR_MIN_SCORE, 50, 0),
    tailorTimeoutMs: clampNumber(source.tailorTimeoutMs || process.env.TAILOR_TIMEOUT_MS, 30000, 1),
  };
}

function selectJobsForTailoring(jobs, { tailorTopN, tailorMinScore }) {
  return (Array.isArray(jobs) ? jobs : [])
    .filter((job) => Number(job?.matchScore) >= tailorMinScore)
    .slice(0, tailorTopN);
}

async function callTailoringAgent({
  tailoringUrl,
  tailorTimeoutMs,
  resumeText,
  candidateName,
  job,
}) {
  if (!tailoringUrl) {
    throw new Error("tailoringUrl is required.");
  }

  const jobDescription = String(job?.normalizedJobDescription || job?.descriptionText || "").trim();
  if (!jobDescription) {
    throw new Error(`Job ${job?.id || job?.title || "unknown"} does not have usable job description text.`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), tailorTimeoutMs);

  try {
    const response = await fetch(tailoringUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resume_text: String(resumeText || ""),
        job_description: jobDescription,
        candidate_name: candidateName || null,
      }),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch (_err) {
      parsed = bodyText;
    }

    if (!response.ok) {
      throw new Error(
        `Tailoring request failed with ${response.status} ${response.statusText}: ${
          typeof parsed === "string" ? parsed : JSON.stringify(parsed)
        }`
      );
    }

    const tailoredMatchScore =
      parsed?.match_score ??
      parsed?.ats_score_after?.final_score ??
      parsed?.ats_score ??
      null;

    return {
      jobId: job?.id || null,
      title: job?.title || null,
      originalMatchScore: Number(job?.matchScore) || 0,
      tailoredResume: parsed?.tailored_resume || null,
      tailoredMatchScore,
      modelUsed: parsed?.model_used || null,
      raw: parsed,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function tailorMatchedJobs({
  resumeText,
  candidateName,
  jobs,
  config = {},
}) {
  const tailoringConfig = buildTailoringConfig(config);
  if (!tailoringConfig.tailoringUrl) {
    return {
      enabled: false,
      attempted: 0,
      completed: 0,
      jobs: [],
    };
  }

  const selectedJobs = selectJobsForTailoring(jobs, tailoringConfig);
  const results = [];
  const failures = [];

  for (const job of selectedJobs) {
    try {
      const result = await callTailoringAgent({
        tailoringUrl: tailoringConfig.tailoringUrl,
        tailorTimeoutMs: tailoringConfig.tailorTimeoutMs,
        resumeText,
        candidateName,
        job,
      });
      results.push(result);
    } catch (error) {
      failures.push({
        jobId: job?.id || null,
        title: job?.title || null,
        originalMatchScore: Number(job?.matchScore) || 0,
        error: error && error.message ? error.message : String(error),
      });
    }
  }

  return {
    enabled: true,
    attempted: selectedJobs.length,
    completed: results.length,
    failed: failures.length,
    jobs: results,
    failures,
    status: failures.length ? "failed" : "completed",
    config: {
      tailoringUrl: tailoringConfig.tailoringUrl,
      tailorTopN: tailoringConfig.tailorTopN,
      tailorMinScore: tailoringConfig.tailorMinScore,
    },
  };
}

module.exports = {
  buildTailoringConfig,
  callTailoringAgent,
  selectJobsForTailoring,
  tailorMatchedJobs,
};
