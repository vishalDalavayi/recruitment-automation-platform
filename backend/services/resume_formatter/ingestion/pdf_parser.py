from io import BytesIO


def parse_pdf_bytes(file_bytes: bytes) -> str:
    errors: list[str] = []

    try:
        text = _parse_with_pymupdf(file_bytes)
        if text:
            return text
    except Exception as exc:
        errors.append(str(exc))

    try:
        text = _parse_with_pdfplumber(file_bytes)
        if text:
            return text
    except Exception as exc:
        errors.append(str(exc))

    raise ValueError("Failed to extract text from the uploaded PDF file." + _format_errors(errors))


def _parse_with_pymupdf(file_bytes: bytes) -> str:
    try:
        import fitz
    except ImportError as exc:  # pragma: no cover - depends on runtime environment
        raise RuntimeError("PyMuPDF is required to parse PDF resumes.") from exc

    pages: list[str] = []
    document = fitz.open(stream=file_bytes, filetype="pdf")

    try:
        for page in document:
            blocks = page.get_text("blocks")
            page_lines = [block[4].strip() for block in blocks if len(block) > 4 and block[4].strip()]
            if page_lines:
                pages.append("\n".join(page_lines))
                continue

            plain_text = page.get_text("text").strip()
            if plain_text:
                pages.append(plain_text)
    finally:
        document.close()

    return "\n\n".join(pages).strip()


def _parse_with_pdfplumber(file_bytes: bytes) -> str:
    try:
        import pdfplumber
    except ImportError as exc:  # pragma: no cover - depends on runtime environment
        raise RuntimeError("pdfplumber is required as a PDF parsing fallback.") from exc

    pages: list[str] = []

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text.strip())

    return "\n\n".join(pages).strip()


def _format_errors(errors: list[str]) -> str:
    if not errors:
        return ""
    return f" Parser details: {' | '.join(errors)}"
