const fs = require("node:fs");
const path = require("node:path");

function extLower(filePath) {
  return path.extname(String(filePath || "")).toLowerCase();
}

function loadPdfParse() {
  try {
    return require("pdf-parse");
  } catch (err) {
    const e = new Error(
      "Missing dependency: pdf-parse. Install dependencies (npm i) to read PDF resumes."
    );
    e.cause = err;
    throw e;
  }
}

function loadMammoth() {
  try {
    return require("mammoth");
  } catch (err) {
    const e = new Error(
      "Missing dependency: mammoth. Install dependencies (npm i) to read DOCX resumes."
    );
    e.cause = err;
    throw e;
  }
}

async function readPdfText(filePath) {
  const pdfParse = loadPdfParse();
  const buf = await fs.promises.readFile(filePath);
  const result = await pdfParse(buf);
  return String(result && result.text ? result.text : "");
}

async function readPdfBufferText(buffer) {
  const pdfParse = loadPdfParse();
  const result = await pdfParse(buffer);
  return String(result && result.text ? result.text : "");
}

async function readDocxText(filePath) {
  const mammoth = loadMammoth();
  const result = await mammoth.extractRawText({ path: filePath });
  return String(result && result.value ? result.value : "");
}

async function readDocxBufferText(buffer) {
  const mammoth = loadMammoth();
  const result = await mammoth.extractRawText({ buffer });
  return String(result && result.value ? result.value : "");
}

async function extractTextFromBuffer(buffer, fileName = "") {
  if (!Buffer.isBuffer(buffer)) throw new Error("buffer must be a Buffer");

  const ext = extLower(fileName);
  if (ext === ".pdf") return readPdfBufferText(buffer);
  if (ext === ".docx") return readDocxBufferText(buffer);
  return buffer.toString("utf8");
}

async function extractTextFromBase64(contentBase64, fileName = "") {
  const value = String(contentBase64 || "").trim();
  if (!value) throw new Error("contentBase64 is required");

  const normalized = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length) throw new Error("contentBase64 did not decode into any bytes");
  return extractTextFromBuffer(buffer, fileName);
}

async function extractTextFromFile(filePath) {
  const p = String(filePath || "");
  if (!p) throw new Error("filePath is required");

  const ext = extLower(p);
  if (ext === ".pdf") return readPdfText(p);
  if (ext === ".docx") return readDocxText(p);

  // Default: treat as plain text (txt/md/rtf/etc).
  return fs.promises.readFile(p, "utf8");
}

module.exports = {
  extractTextFromBase64,
  extractTextFromBuffer,
  extractTextFromFile,
};
