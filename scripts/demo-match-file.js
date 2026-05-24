const path = require("node:path");
const { matching } = require("../src/index");
const { extractTextFromFile } = require("../src/io/extractText");

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { resumes: [] };

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--jd") out.jdPath = args[++i];
    else if (a === "--resume") out.resumes.push(args[++i]);
    else if (a === "--topK") out.topK = Number(args[++i]);
    else if (a === "--name") {
      const name = args[++i];
      const lastIdx = out.resumes.length - 1;
      if (lastIdx < 0) throw new Error("--name must come after --resume");
      out.resumes[lastIdx] = { path: out.resumes[lastIdx], name };
    } else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error(`Unknown arg: ${a}`);
  }

  return out;
}

function usage() {
  return [
    "Usage:",
    "  npm run demo:match:file -- --jd <job.txt|pdf|docx> --resume <resume.pdf|docx|txt> [--name <label>] [--resume ...] [--topK 5]",
    "",
    "Examples:",
    "  npm run demo:match:file -- --jd jd.txt --resume resume.pdf --name \"Candidate A\"",
    "  npm run demo:match:file -- --jd jd.docx --resume a.docx --resume b.pdf --topK 2",
  ].join("\n");
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(usage());
    process.exit(0);
  }

  if (!opts.jdPath) throw new Error("--jd is required");
  if (!opts.resumes.length) throw new Error("At least one --resume is required");

  const jobDescription = await extractTextFromFile(opts.jdPath);
  const candidates = [];
  for (const r of opts.resumes) {
    const resumePath = typeof r === "string" ? r : r.path;
    const name = typeof r === "string" ? path.basename(resumePath) : r.name || path.basename(resumePath);
    const resumeText = await extractTextFromFile(resumePath);
    candidates.push({ id: resumePath, name, resumeText });
  }

  const result = matching.matchCandidates({
    jobDescription,
    candidates,
    topK: opts.topK || 5,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

