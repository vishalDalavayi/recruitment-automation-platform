"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const dir = path.join(root, "docs", "fixtures", "matching");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
}

function needKeys(obj, keys, label) {
  for (const k of keys) {
    if (!(k in obj)) throw new Error(`${label}: missing "${k}"`);
  }
}

try {
  const resume = readJson("formatted-resume-sample.json");
  needKeys(resume, ["Name", "Professional_Experience"], "formatted-resume-sample.json");

  const row = readJson("scraped-job-row.sample.json");
  needKeys(row, ["source_table", "serial_no", "title"], "scraped-job-row.sample.json");

  const mapped = readJson("job-mapped-for-matcher.expected.json");
  if (!Array.isArray(mapped) || !mapped.length) throw new Error("job-mapped-for-matcher.expected.json must be a non-empty array");
  needKeys(mapped[0], ["id", "source_table", "title", "description_text"], "job-mapped mapped[0]");

  const post = readJson("post-match-jobs-request.python-style.sample.json");
  needKeys(post, ["resumeId", "jobs", "topK"], "post-match-jobs-request.python-style.sample.json");

  console.log("validate-matching-fixtures: OK");
  process.exitCode = 0;
} catch (err) {
  console.error("validate-matching-fixtures: FAIL", err.message);
  process.exitCode = 1;
}
