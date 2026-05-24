from pathlib import Path

from services.resume_formatter.ingestion.docx_parser import parse_docx_bytes
from services.resume_formatter.ingestion.pdf_parser import parse_pdf_bytes


SUPPORTED_FILE_TYPES = {"pdf", "docx"}


def parse_resume_file(file_bytes: bytes, file_name: str) -> tuple[str, str]:
    extension = Path(file_name).suffix.lower().lstrip(".")
    if extension not in SUPPORTED_FILE_TYPES:
        supported = ", ".join(sorted(SUPPORTED_FILE_TYPES))
        raise ValueError(f"Unsupported file type '{extension}'. Supported types: {supported}.")

    if extension == "pdf":
        return extension, parse_pdf_bytes(file_bytes)

    return extension, parse_docx_bytes(file_bytes)
