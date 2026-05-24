import json
import re
from typing import Any

from services.resume_formatter.schemas.resume_schema import ResumeContent
from services.resume_formatter.extraction.llm_provider_factory import BaseLLMProvider
from services.resume_formatter.extraction.prompt_templates import (
    RESUME_EXTRACTION_RULES,
    RESUME_EXTRACTION_SCHEMA,
    SYSTEM_PROMPT,
    USER_PROMPT_TEMPLATE,
)



def extract_resume_content(
    provider: BaseLLMProvider,
    resume_text: str,
    schema: str = RESUME_EXTRACTION_SCHEMA,
    rules: str = RESUME_EXTRACTION_RULES,
) -> ResumeContent:
    user_prompt = build_resume_prompt(
        resume_text=resume_text,
        schema=schema,
        rules=rules,
    )
    completion = provider.complete(SYSTEM_PROMPT, user_prompt)
    _, resume_content = parse_resume_response(completion.content)
    return resume_content


def build_resume_prompt(
    resume_text: str,
    schema: str = RESUME_EXTRACTION_SCHEMA,
    rules: str = RESUME_EXTRACTION_RULES,
) -> str:
    return USER_PROMPT_TEMPLATE.format(
        schema=schema,
        rules=rules,
        resume_text=resume_text,
    )


def parse_resume_response(
    raw_response: str,
) -> tuple[dict[str, Any], ResumeContent]:
    payload = extract_llm_json_payload(raw_response)
    resume_content = build_resume_content_from_payload(payload)
    return payload, resume_content


def extract_llm_json_payload(raw_response: str) -> dict[str, Any]:
    return _extract_json_object(raw_response)


def build_resume_content_from_payload(
    payload: dict[str, Any],
) -> ResumeContent:
    return ResumeContent.model_validate(payload)


def _extract_json_object(raw_response: str) -> dict[str, Any]:
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise RuntimeError("LLM response did not contain a valid JSON object.")

        snippet = cleaned[start : end + 1]
        try:
            parsed = json.loads(snippet)
        except json.JSONDecodeError as exc:
            raise RuntimeError("LLM response contained malformed JSON.") from exc

    if not isinstance(parsed, dict):
        raise RuntimeError("LLM response JSON must be an object.")

    return parsed
