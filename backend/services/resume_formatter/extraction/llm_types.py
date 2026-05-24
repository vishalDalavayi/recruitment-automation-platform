from dataclasses import dataclass, field


@dataclass(frozen=True)
class LLMTokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


@dataclass(frozen=True)
class LLMCompletion:
    content: str
    usage: LLMTokenUsage = field(default_factory=LLMTokenUsage)
