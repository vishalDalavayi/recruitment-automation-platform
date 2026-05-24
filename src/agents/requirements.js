const { normalizeWhitespace, tokenizeWords, unique } = require("./text");
const { buildSkillGroups } = require("./skillTaxonomy");

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function isHeading(line) {
  const lower = String(line || "").trim().toLowerCase();
  return (
    /^(required|requirements|must\s*have|must-have|minimum\s*qualifications)\s*:?$/.test(lower) ||
    /^(preferred|preferred\s*qualifications|nice\s*to\s*have|plus)\s*:?$/.test(lower)
  );
}

function headingMode(line) {
  const lower = String(line || "").trim().toLowerCase();
  if (/^(required|requirements|must\s*have|must-have|minimum\s*qualifications)\s*:?$/.test(lower)) return "required";
  if (/^(preferred|preferred\s*qualifications|nice\s*to\s*have|plus)\s*:?$/.test(lower)) return "preferred";
  return null;
}

function looksLikeBullet(line) {
  return /^[-*•]\s+/.test(String(line || "").trim());
}

function stripBullet(line) {
  return String(line || "").trim().replace(/^[-*•]\s+/, "");
}

function splitNormalizedLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function titleLikeLine(jdText) {
  const lines = splitNormalizedLines(jdText);
  return lines.find((line) => line.length <= 120 && !/:$/.test(line)) || "";
}

const REQUIRED_CONTEXT_RE =
  /\b(required|requirements|must\s*have|must-have|minimum\s*qualifications|basic\s*qualifications|you have|must possess|priorities for this role|experience with|strong (?:comfort|experience|knowledge)|proficien(?:cy|t) in|skilled in|expertise in)\b/i;
const PREFERRED_CONTEXT_RE =
  /\b(preferred|preferred qualifications|nice\s*to\s*have|plus|we hope you bring|bonus|ideally)\b/i;

function extractContextualSkillMatches(jdText, groups) {
  const lines = splitNormalizedLines(jdText);
  const requiredSegments = [];
  const preferredSegments = [];

  let mode = null;
  let remainingContextLines = 0;

  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line) continue;

    if (PREFERRED_CONTEXT_RE.test(line)) {
      mode = "preferred";
      remainingContextLines = 6;
      preferredSegments.push(line);
      continue;
    }

    if (REQUIRED_CONTEXT_RE.test(line)) {
      mode = "required";
      remainingContextLines = 6;
      requiredSegments.push(line);
      continue;
    }

    const bullet = looksLikeBullet(line);
    const cleaned = bullet ? stripBullet(line) : line;
    if (mode && (bullet || remainingContextLines > 0)) {
      if (mode === "required") requiredSegments.push(cleaned);
      if (mode === "preferred") preferredSegments.push(cleaned);
      remainingContextLines = Math.max(remainingContextLines - 1, 0);
      continue;
    }

    mode = null;
    remainingContextLines = 0;
  }

  return {
    requiredSkills: detectGroupMatches(requiredSegments.join("\n"), groups),
    preferredSkills: detectGroupMatches(preferredSegments.join("\n"), groups),
  };
}

function extractPreferredAndRequired(jdText) {
  const text = normalizeWhitespace(jdText);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  let mode = null; // "required" | "preferred" | null
  const requiredLines = [];
  const preferredLines = [];

  for (const raw of lines) {
    const line = String(raw || "").trim();
    const modeFromHeading = headingMode(line);
    if (modeFromHeading) {
      mode = modeFromHeading;
      continue;
    }

    const inlineRequired = line.match(
      /^(required|requirements|must\s*have|must-have|minimum\s*qualifications)\s*:\s*(.+)$/i
    );
    if (inlineRequired) {
      requiredLines.push(inlineRequired[2].trim());
      mode = "required";
      continue;
    }

    const inlinePreferred = line.match(
      /^(preferred|preferred\s*qualifications|nice\s*to\s*have|plus)\s*:\s*(.+)$/i
    );
    if (inlinePreferred) {
      preferredLines.push(inlinePreferred[2].trim());
      mode = "preferred";
      continue;
    }

    // Inline tags: "Required:" in the same line as a bullet.
    const lower = line.toLowerCase();
    if (/\brequired\b/.test(lower) && looksLikeBullet(line)) mode = "required";
    if (/\bpreferred\b/.test(lower) && looksLikeBullet(line)) mode = "preferred";

    // Only capture bullets/lists under headings; avoid pulling whole paragraphs.
    if (mode && (looksLikeBullet(line) || line.length <= 120)) {
      const cleaned = looksLikeBullet(line) ? stripBullet(line) : line;
      if (mode === "required") requiredLines.push(cleaned);
      if (mode === "preferred") preferredLines.push(cleaned);
    }

    // If a new unrelated heading starts, stop current mode.
    if (isHeading(line) && !modeFromHeading) mode = null;
  }

  return {
    requiredText: requiredLines.join("\n"),
    preferredText: preferredLines.join("\n"),
    fullText: text,
  };
}

function extractYearsFloor(jdText) {
  const text = String(jdText || "");
  const matches = Array.from(text.matchAll(/(\d{1,2})\s*\+?\s*years?/gi))
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 50);
  if (!matches.length) return null;
  // Use the minimum as the floor signal.
  return Math.min(...matches);
}

function extractJobRequirements(jobDescription, { skillGroups = null } = {}) {
  const jd = normalizeWhitespace(jobDescription);
  const groups = buildSkillGroups(skillGroups || []);
  const parts = extractPreferredAndRequired(jd);
  const contextual = extractContextualSkillMatches(parts.fullText, groups);
  const titleSkills = detectGroupMatches(titleLikeLine(jd), groups);
  const fullTextSkills = detectGroupMatches(parts.fullText, groups);

  const explicitRequiredSkills = detectGroupMatches(parts.requiredText, groups);
  const explicitPreferredSkills = detectGroupMatches(parts.preferredText, groups);

  const requiredSkills = unique(
    explicitRequiredSkills
      .concat(contextual.requiredSkills)
      .concat(titleSkills)
      .concat(explicitRequiredSkills.length || contextual.requiredSkills.length || titleSkills.length ? [] : fullTextSkills)
  );
  const preferredSkills = unique(explicitPreferredSkills.concat(contextual.preferredSkills)).filter(
    (skill) => !requiredSkills.includes(skill)
  );

  // Basic role keywords: top frequent tokens that aren't stopwords.
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
  const tokens = tokenizeWords(jd).filter((t) => t.length >= 4 && !stop.has(t));
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  const roleKeywords = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([t]) => t)
    .filter((t) => !requiredSkills.includes(t) && !preferredSkills.includes(t));

  return {
    requiredSkills,
    preferredSkills,
    // Groups are canonical skills; downstream uses groupCoverageRatio.
    requiredSkillGroups: requiredSkills.map((s) => [s]),
    preferredSkillGroups: preferredSkills.map((s) => [s]),
    roleKeywords,
    keywordSet: unique(requiredSkills.concat(preferredSkills).concat(roleKeywords)).slice(0, 60),
    experienceFloorYears: extractYearsFloor(jd),
  };
}

module.exports = {
  extractJobRequirements,
  extractYearsFloor,
};
