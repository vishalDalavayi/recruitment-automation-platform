const { spawnSync } = require("node:child_process");
const { Pool } = require("pg");
const { matching } = require("../src");
const { mapSourceResumeRow } = require("./run-db-match-caller");

function requireSourceDatabaseUrl() {
  const url = String(process.env.SOURCE_DATABASE_URL || "").trim();
  if (!url) {
    throw new Error(
      "Set SOURCE_DATABASE_URL (postgresql://...) before running compare-matching-methods.js"
    );
  }
  return url;
}

const DEFAULT_SOURCE_DB = requireSourceDatabaseUrl();
const DEFAULT_RESUME_TABLE =
  process.env.SOURCE_RESUME_TABLE || "candidate_details.formatting_resume_info";
const DEFAULT_JOB_TABLES =
  (process.env.SOURCE_JOBS_TABLES || "scrapped_data.active_scraped_data,scrapped_data.inactive_scraped_data")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const SKILL_LEXICON = [
  "python",
  "sql",
  "java",
  "javascript",
  "react",
  "fastapi",
  "django",
  "postgresql",
  "mongodb",
  "aws",
  "azure",
  "docker",
  "kubernetes",
  "machine learning",
  "deep learning",
  "nlp",
  "data analysis",
  "pandas",
  "numpy",
  "scikit-learn",
  "tensorflow",
  "pytorch",
  "tableau",
  "power bi",
  "excel",
  "communication",
  "leadership",
  "project management",
  "agile",
  "scrum",
  "rest api",
  "git",
  "linux",
  "statistics",
  "data visualization",
  "c++",
  "c#",
  "node",
  "typescript",
  "html",
  "css",
  "spark",
  "hadoop",
  "airflow",
  "selenium",
  "testing",
  "debugging",
  "ci/cd",
  "devops",
  "oracle",
  "sql server",
  "dba",
];

function parseArgs(argv) {
  const out = {
    resumeId: "",
    jobLimit: 10,
    topK: 5,
  };

  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--resume-id") out.resumeId = args[++index];
    else if (arg === "--job-limit") out.jobLimit = Number(args[++index]);
    else if (arg === "--topK") out.topK = Number(args[++index]);
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }

  return out;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/compare-matching-methods.js --resume-id <uuid> [--job-limit 10] [--topK 5]",
    "",
    "Compares:",
    "  - current ATS-style matcher",
    "  - partner tailoring scorer (keyword overlap + TF-IDF cosine)",
    "  - ChatGPT-style hybrid scorer (keyword + TF-IDF + embeddings + required-skill hit rate)",
  ].join("\n");
}

function quoteIdentifier(value) {
  return String(value)
    .split(".")
    .map((part) => `"${part}"`)
    .join(".");
}

async function fetchResume(pool, resumeId) {
  const result = await pool.query(
    `
      select to_jsonb(t) as row
      from ${quoteIdentifier(DEFAULT_RESUME_TABLE)} t
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

  if (!result.rows.length) throw new Error(`No resume found for ${resumeId}`);
  const mapped = mapSourceResumeRow(result.rows[0].row || {}, resumeId);
  if (mapped.formatted_resume_status && mapped.formatted_resume_status !== "completed") {
    throw new Error(`Resume ${resumeId} is not completed in ${DEFAULT_RESUME_TABLE}.`);
  }
  return {
    resumeId: mapped.resume_id,
    candidateName: mapped.candidate_name,
    resumeText: mapped.formatted_resume_text,
  };
}

async function fetchJobs(pool, limit) {
  const rows = (
    await Promise.all(
      DEFAULT_JOB_TABLES.map((tableName) =>
        pool.query(
          `
            select to_jsonb(t) as row
            from ${quoteIdentifier(tableName)} t
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
          [limit]
        )
      )
    )
  ).flatMap((result, index) =>
    result.rows.map((row) => ({ row: row.row || {}, tableName: DEFAULT_JOB_TABLES[index] }))
  );

  const seen = new Set();
  const jobs = [];
  for (const item of rows) {
    const row = item.row;
    const mapped = {
      id: pickFirst([row.job_id, row.id, row.serial_no, row.url]),
      title: pickFirst([row.title, row.job_title, row.position, row.role]),
      company_name: pickFirst([row.company_name, row.company, row.employer_name]),
      location: pickFirst([row.location, row.job_location, row.city]),
      url: pickFirst([row.url, row.job_url, row.link]),
      source: item.tableName,
      description_text: pickFirst([row.description_text, row.description, row.job_description]),
      normalized_jd_text: pickFirst([row.normalized_jd_text, row.normalized_job_description]),
    };
    const key = pickFirst([mapped.id, mapped.url, `${mapped.title}|${mapped.company_name}|${mapped.location}`]);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    jobs.push(mapped);
    if (jobs.length >= limit) break;
  }

  return jobs;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text) {
  const source = normalize(text);
  const found = new Set();
  for (const skill of SKILL_LEXICON) {
    const pattern = new RegExp(`(?<!\\w)${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`, "i");
    if (pattern.test(source)) found.add(skill);
  }
  return found;
}

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function termFrequencies(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

function tfidfCosineSimilarity(a, b) {
  const docs = [tokenize(a), tokenize(b)];
  const termCounts = docs.map((tokens) => termFrequencies(tokens));
  const vocabulary = Array.from(new Set(docs.flat()));
  if (!vocabulary.length) return 0;

  const documentFrequencies = new Map();
  for (const term of vocabulary) {
    let count = 0;
    for (const counts of termCounts) {
      if (counts.has(term)) count += 1;
    }
    documentFrequencies.set(term, count);
  }

  const vectors = termCounts.map((counts, docIndex) => {
    const totalTerms = docs[docIndex].length || 1;
    return vocabulary.map((term) => {
      const tf = (counts.get(term) || 0) / totalTerms;
      const df = documentFrequencies.get(term) || 0;
      const idf = Math.log((docs.length + 1) / (df + 1)) + 1;
      return tf * idf;
    });
  });

  const dot = vectors[0].reduce((sum, value, index) => sum + value * vectors[1][index], 0);
  const magA = Math.sqrt(vectors[0].reduce((sum, value) => sum + value * value, 0));
  const magB = Math.sqrt(vectors[1].reduce((sum, value) => sum + value * value, 0));
  if (!magA || !magB) return 0;
  return dot / (magA * magB);
}

function similarityBaselineScore(resumeText, jobDescription) {
  const resumeKeywords = extractKeywords(resumeText);
  const jdKeywords = extractKeywords(jobDescription);
  const matched = Array.from(resumeKeywords).filter((keyword) => jdKeywords.has(keyword));
  const keywordScore = jdKeywords.size ? (matched.length / jdKeywords.size) * 100 : 0;
  const tfidfScore = tfidfCosineSimilarity(resumeText, jobDescription) * 100;
  const finalScore = 0.6 * keywordScore + 0.4 * tfidfScore;

  return {
    finalScore: Number(finalScore.toFixed(2)),
    keywordScore: Number(keywordScore.toFixed(2)),
    tfidfScore: Number(tfidfScore.toFixed(2)),
    matchedKeywords: matched.sort(),
  };
}

function rankPartnerTailoringScorer(resumeText, jobs, topK) {
  return jobs
    .map((job) => {
      const jobDescription = String(job.normalized_jd_text || job.description_text || "").trim();
      const result = similarityBaselineScore(resumeText, jobDescription);
      return {
        id: job.id,
        title: job.title,
        company_name: job.company_name,
        similarityScore: result.finalScore,
        keywordScore: result.keywordScore,
        tfidfScore: result.tfidfScore,
        matchedKeywords: result.matchedKeywords,
      };
    })
    .sort(
      (a, b) =>
        (b.similarityScore || 0) - (a.similarityScore || 0) ||
        String(a.title || "").localeCompare(String(b.title || ""))
    )
    .slice(0, topK);
}

function runChatGptHybridScorer(resumeText, jobs, topK) {
  const payload = {
    resume_text: resumeText,
    embedding_model: "all-MiniLM-L6-v2",
    jobs: jobs.map((job) => {
      const jobDescription = String(job.normalized_jd_text || job.description_text || "").trim();
      const requirements = matching.extractJobRequirements(jobDescription);
      return {
        id: job.id,
        title: job.title,
        company_name: job.company_name,
        job_description: jobDescription,
        required_skills: Array.isArray(requirements.requiredSkills) ? requirements.requiredSkills : [],
      };
    }),
  };

  const result = spawnSync(".venv-compare/bin/python3", ["scripts/chatgpt_hybrid_scorer.py"], {
    cwd: process.cwd(),
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: {
      ...process.env,
      HF_HOME: process.env.HF_HOME || `${process.cwd()}/.hf-cache`,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      [
        "ChatGPT hybrid scorer failed.",
        result.stderr || result.stdout || `exit=${result.status}`,
      ].join("\n")
    );
  }

  const parsed = JSON.parse(result.stdout || "{}");
  return (parsed.results || [])
    .map((job) => ({
      id: job.id,
      title: job.title,
      company_name: job.company_name,
      hybridScore: job.final_score,
      keywordScore: job.keyword_score,
      tfidfScore: job.tfidf_score,
      embeddingScore: job.embedding_score,
      requiredScore: job.required_score,
      matchedKeywords: job.matched_keywords || [],
      missingKeywords: job.missing_keywords || [],
    }))
    .sort(
      (a, b) =>
        (b.hybridScore || 0) - (a.hybridScore || 0) ||
        String(a.title || "").localeCompare(String(b.title || ""))
    )
    .slice(0, topK);
}

function printComparison(currentMatcher, partnerScorer, chatGptHybrid) {
  console.log("\nCURRENT ATS-STYLE MATCHER");
  currentMatcher.jobs.forEach((job, index) => {
    console.log(
      `${index + 1}. ${job.title} @ ${job.company || "Unknown"} | match=${job.matchScore} | ats=${job.atsScore} | eligible=${job.eligible}`
    );
  });

  console.log("\nPARTNER TAILORING SCORER (60% keyword + 40% TF-IDF)");
  partnerScorer.forEach((job, index) => {
    console.log(
      `${index + 1}. ${job.title} @ ${job.company_name || "Unknown"} | score=${job.similarityScore} | keyword=${job.keywordScore} | tfidf=${job.tfidfScore}`
    );
  });

  console.log("\nCHATGPT-STYLE HYBRID (35% keyword + 25% TF-IDF + 30% embedding + 10% required)");
  chatGptHybrid.forEach((job, index) => {
    console.log(
      `${index + 1}. ${job.title} @ ${job.company_name || "Unknown"} | score=${job.hybridScore} | keyword=${job.keywordScore} | tfidf=${job.tfidfScore} | embedding=${job.embeddingScore} | required=${job.requiredScore}`
    );
  });

  console.log("\nTOP-RANK DIFFERENCE");
  const currentTop = currentMatcher.jobs[0];
  const partnerTop = partnerScorer[0];
  const hybridTop = chatGptHybrid[0];
  console.log(
    JSON.stringify(
      {
        currentTop: currentTop
          ? {
              id: currentTop.id,
              title: currentTop.title,
              company: currentTop.company,
              matchScore: currentTop.matchScore,
              atsScore: currentTop.atsScore,
            }
          : null,
        partnerTop: partnerTop
          ? {
              id: partnerTop.id,
              title: partnerTop.title,
              company: partnerTop.company_name,
              similarityScore: partnerTop.similarityScore,
              keywordScore: partnerTop.keywordScore,
              tfidfScore: partnerTop.tfidfScore,
            }
          : null,
        chatGptHybridTop: hybridTop
          ? {
              id: hybridTop.id,
              title: hybridTop.title,
              company: hybridTop.company_name,
              hybridScore: hybridTop.hybridScore,
              keywordScore: hybridTop.keywordScore,
              tfidfScore: hybridTop.tfidfScore,
              embeddingScore: hybridTop.embeddingScore,
              requiredScore: hybridTop.requiredScore,
            }
          : null,
      },
      null,
      2
    )
  );
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help || !options.resumeId) {
    console.log(usage());
    process.exit(options.help ? 0 : 1);
  }

  const pool = new Pool({
    connectionString: DEFAULT_SOURCE_DB,
    allowExitOnIdle: true,
  });

  try {
    const resume = await fetchResume(pool, options.resumeId);
    const jobs = await fetchJobs(pool, options.jobLimit);

    const currentMatcher = matching.matchJobsForResume({
      resumeText: resume.resumeText,
      jobs,
      topK: options.topK,
    });

    const partnerScorer = rankPartnerTailoringScorer(resume.resumeText, jobs, options.topK);
    const chatGptHybrid = runChatGptHybridScorer(resume.resumeText, jobs, options.topK);

    console.log(`Resume: ${resume.resumeId} | ${resume.candidateName || "Unknown"}`);
    console.log(`Jobs compared: ${jobs.length}`);
    printComparison(currentMatcher, partnerScorer, chatGptHybrid);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  });
}
