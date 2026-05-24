from typing import Any

from services.resume_formatter.extraction.llm_types import LLMTokenUsage


def extract_openai_compatible_usage(response: Any) -> LLMTokenUsage:
    usage = _get_value(response, "usage")
    input_tokens = _coerce_int(_get_value(usage, "prompt_tokens", "input_tokens"))
    output_tokens = _coerce_int(_get_value(usage, "completion_tokens", "output_tokens"))
    total_tokens = _coerce_int(_get_value(usage, "total_tokens"))

    return _build_usage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
    )


def extract_ollama_usage(body: dict[str, Any]) -> LLMTokenUsage:
    input_tokens = _coerce_int(_get_value(body, "prompt_eval_count"))
    output_tokens = _coerce_int(_get_value(body, "eval_count"))

    return _build_usage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=0,
    )


def _build_usage(
    *,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
) -> LLMTokenUsage:
    resolved_total_tokens = total_tokens
    if not resolved_total_tokens and (input_tokens or output_tokens):
        resolved_total_tokens = input_tokens + output_tokens

    return LLMTokenUsage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=resolved_total_tokens,
    )


def _get_value(source: Any, *keys: str) -> Any:
    if source is None:
        return None

    for key in keys:
        if isinstance(source, dict):
            value = source.get(key)
        else:
            value = getattr(source, key, None)

        if value is not None:
            return value

    return None


def _coerce_int(value: Any) -> int:
    if value is None:
        return 0

    try:
        return int(value)
    except (TypeError, ValueError):
        return 0
