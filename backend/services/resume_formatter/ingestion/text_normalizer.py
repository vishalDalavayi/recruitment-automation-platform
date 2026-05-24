import re


BULLET_PATTERN = re.compile(r"[•●▪◦‣∙]")
WHITESPACE_PATTERN = re.compile(r"[ \t]+")
SECTION_HEADER_PATTERN = re.compile(r"^[A-Z][A-Z\s/&-]{2,}$")


def normalize_resume_text(raw_text: str) -> str:
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    text = BULLET_PATTERN.sub("-", text)
    text = text.replace("\uf0b7", "-")

    lines = [WHITESPACE_PATTERN.sub(" ", line).strip() for line in text.split("\n")]
    collapsed_lines = _collapse_blank_lines(lines)
    merged_lines = _merge_wrapped_lines(collapsed_lines)

    normalized = "\n".join(merged_lines)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _collapse_blank_lines(lines: list[str]) -> list[str]:
    normalized: list[str] = []
    previous_blank = False

    for line in lines:
        if not line:
            if not previous_blank:
                normalized.append("")
            previous_blank = True
            continue

        normalized.append(line)
        previous_blank = False

    return normalized


def _merge_wrapped_lines(lines: list[str]) -> list[str]:
    merged: list[str] = []

    for line in lines:
        if not line:
            merged.append("")
            continue

        if merged and _should_merge(merged[-1], line):
            previous = merged.pop()
            if previous.endswith("-"):
                merged.append(previous[:-1] + line)
            else:
                merged.append(f"{previous} {line}")
            continue

        merged.append(line)

    return merged


def _should_merge(previous_line: str, current_line: str) -> bool:
    if not previous_line or not current_line:
        return False
    if previous_line.endswith(":"):
        return False
    if previous_line.startswith("-") or current_line.startswith("-"):
        return False
    if SECTION_HEADER_PATTERN.match(previous_line):
        return False
    if SECTION_HEADER_PATTERN.match(current_line):
        return False
    if previous_line.endswith((".", "!", "?")):
        return False
    if current_line[0].isupper() and previous_line[-1].isupper():
        return False

    return current_line[0].islower() or previous_line.endswith("-")
