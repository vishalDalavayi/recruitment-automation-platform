function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function tokenizeWords(value) {
  const text = normalizeWhitespace(value).toLowerCase();
  if (text.length === 0) return [];
  // Keep + and # for things like C++, C#.
  return text
    .replace(/[^a-z0-9+#.\-\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

module.exports = {
  normalizeWhitespace,
  tokenizeWords,
  unique,
  clamp,
};
