function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtmlToText(value) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|h\d|section|article|br|tr|td)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickFirstValue(values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function pickFirstObject(values) {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  }
  return null;
}

function buildJobDescriptionFromPosting(job = {}) {
  const title = pickFirstValue([job.title, job.job_title, job.position]);
  const company = pickFirstValue([job.company, job.company_name, job.employer_name]);
  const location = pickFirstValue([job.location, job.job_location, job.candidate_required_location]);
  const url = pickFirstValue([job.url, job.job_url, job.apply_url]);
  const source = pickFirstValue([job.source, job.publisher, job.source_publisher]);
  const jobType = pickFirstValue([job.job_type, job.employment_type]);
  const salary = pickFirstValue([job.salary, job.salary_range]);
  const publicationDate = pickFirstValue([job.publication_date, job.posted_at, job.date_posted]);
  const descriptionText = pickFirstValue([
    job.description_text,
    job.description,
    stripHtmlToText(job.description_html),
  ]);

  const lines = [
    title ? `TITLE: ${title}` : "",
    company ? `COMPANY: ${company}` : "",
    location ? `LOCATION: ${location}` : "",
    source ? `SOURCE: ${source}` : "",
    jobType ? `JOB TYPE: ${jobType}` : "",
    salary ? `SALARY: ${salary}` : "",
    publicationDate ? `PUBLICATION DATE: ${publicationDate}` : "",
    url ? `URL: ${url}` : "",
    descriptionText ? `JOB DESCRIPTION:\n${descriptionText}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

function pickNormalizedJobDescription(job = {}) {
  return pickFirstValue([
    job.normalizedJobDescription,
    job.normalized_job_description,
    job.normalizedJdText,
    job.normalized_jd_text,
    job.tabnerJobDescription,
    job.tabner_job_description,
    job.jdText,
    job.jd_text,
  ]);
}

function pickPrecomputedRequirements(job = {}) {
  return pickFirstObject([
    job.requirements,
    job.requirementsJson,
    job.requirements_json,
    job.jdRequirements,
    job.jd_requirements,
  ]);
}

function normalizeJobPosting(job = {}) {
  const providedNormalizedJobDescription = pickNormalizedJobDescription(job);
  const normalized = {
    id: job.id || job.job_id || job.url || null,
    title: pickFirstValue([job.title, job.job_title, job.position]) || null,
    company: pickFirstValue([job.company, job.company_name, job.employer_name]) || null,
    location: pickFirstValue([job.location, job.job_location, job.candidate_required_location]) || null,
    url: pickFirstValue([job.url, job.job_url, job.apply_url]) || null,
    source: pickFirstValue([job.source, job.publisher, job.source_publisher]) || null,
    jobType: pickFirstValue([job.job_type, job.employment_type]) || null,
    salary: pickFirstValue([job.salary, job.salary_range]) || null,
    publicationDate: pickFirstValue([job.publication_date, job.posted_at, job.date_posted]) || null,
  };

  normalized.descriptionText = pickFirstValue([
    job.description_text,
    job.description,
    stripHtmlToText(job.description_html),
  ]);
  normalized.providedNormalizedJobDescription = providedNormalizedJobDescription || null;
  normalized.normalizedJobDescription =
    providedNormalizedJobDescription || buildJobDescriptionFromPosting(job);
  normalized.precomputedRequirements = pickPrecomputedRequirements(job);
  return normalized;
}

module.exports = {
  buildJobDescriptionFromPosting,
  normalizeJobPosting,
  pickNormalizedJobDescription,
  stripHtmlToText,
};
