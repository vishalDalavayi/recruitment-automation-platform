const { normalizeWhitespace, unique, tokenizeWords } = require("./text");
const { buildSkillGroups } = require("./skillTaxonomy");

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSectionsIfFormatted(resumeText) {
  const text = normalizeWhitespace(resumeText);
  if (!text) return null;

  const headings = [
    "SUMMARY:",
    "ACADEMICS:",
    "TECHNICAL SKILLS:",
    "PROFESSIONAL EXPERIENCE:",
    "RESPONSIBILITIES:",
    "ENVIRONMENT:",
  ];

  const idx = new Map();
  for (const h of headings) {
    const pos = text.indexOf(h);
    if (pos >= 0) idx.set(h, pos);
  }
  if (!idx.has("SUMMARY:") || !idx.has("TECHNICAL SKILLS:") || !idx.has("PROFESSIONAL EXPERIENCE:")) return null;

  const ordered = Array.from(idx.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([h, pos], i, arr) => {
      const end = i + 1 < arr.length ? arr[i + 1][1] : text.length;
      return { heading: h, start: pos + h.length, end };
    });

  const out = {};
  for (const item of ordered) {
    const key = item.heading.replace(/[:\s]/g, "").toLowerCase();
    out[key] = text.slice(item.start, item.end).trim();
  }
  return out;
}

function detectGroupMatches(text, groups) {
  const source = ` ${String(text || "").toLowerCase()} `;
  const matched = [];

  for (const group of groups || []) {
    const aliases = Array.isArray(group.aliases) ? group.aliases : [];
    for (const alias of aliases) {
      const a = String(alias || "").trim().toLowerCase();
      if (!a) continue;
      const pattern = new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(a)}($|[^a-z0-9+#])`, "i");
      if (pattern.test(source)) {
        matched.push(group.canonical);
        break;
      }
    }
  }

  return unique(matched);
}

function estimateYears(resumeText) {
  const text = String(resumeText || "");
  const matches = Array.from(text.matchAll(/(\d{1,2})\s*\+?\s*years?/gi))
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 50);
  if (!matches.length) return null;
  return Math.max(...matches);
}

function extractResumeRoleKeywords(resumeText) {
  const text = normalizeWhitespace(resumeText);
  const stop = new Set([
    "the",
    "and",
    "or",
    "to",
    "of",
    "in",
    "a",
    "an",
    "for",
    "with",
    "on",
    "as",
    "is",
    "are",
    "be",
    "will",
    "you",
    "we",
    "our",
    "this",
    "that",
  ]);
  const tokens = tokenizeWords(text).filter((t) => t.length >= 4 && !stop.has(t));
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([t]) => t);
}

function extractResumeProfile(resumeText, { skillGroups = null } = {}) {
  const allText = normalizeWhitespace(resumeText);
  const sections = extractSectionsIfFormatted(allText);

  const surfacedText = sections
    ? [sections.summary, sections.technicalskills, sections.environment].filter(Boolean).join("\n")
    : allText;

  const groups = buildSkillGroups(skillGroups || []);
  const allSkills = detectGroupMatches(allText, groups);
  const surfacedSkills = detectGroupMatches(surfacedText, groups);

  return {
    allText,
    surfacedText,
    allSkills,
    surfacedSkills,
    estimatedYears: estimateYears(allText),
    roleKeywords: extractResumeRoleKeywords(allText),
  };
}

module.exports = {
  extractResumeProfile,
};
