from abc import ABC, abstractmethod

from services.resume_formatter.config.settings import LLMProviderName, Settings
from services.resume_formatter.extraction.llm_types import LLMCompletion
from services.resume_formatter.extraction.llm_usage_extractor import extract_ollama_usage, extract_openai_compatible_usage


class BaseLLMProvider(ABC):
    def __init__(self, provider_name: str, model: str) -> None:
        self.provider_name = provider_name
        self.model = model

    @abstractmethod
    def complete(self, system_prompt: str, user_prompt: str) -> LLMCompletion:
        """Generate a response from the configured model."""


class OpenAICompatibleProvider(BaseLLMProvider):
    def __init__(
        self,
        provider_name: str,
        model: str,
        api_key: str,
        base_url: str | None = None,
    ) -> None:
        if not api_key:
            raise ValueError(f"{provider_name} requires an API key in the environment.")

        super().__init__(provider_name=provider_name, model=model)

        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover - depends on runtime environment
            raise RuntimeError("The openai package is required for OpenAI, Grok, and Groq providers.") from exc

        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url

        self.client = OpenAI(**client_kwargs)

    def complete(self, system_prompt: str, user_prompt: str) -> LLMCompletion:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                temperature=0,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:
            raise RuntimeError(f"{self.provider_name} request failed: {exc}") from exc

        content = response.choices[0].message.content
        return LLMCompletion(
            content=content.strip() if content else "",
            usage=extract_openai_compatible_usage(response),
        )


class OllamaProvider(BaseLLMProvider):
    def __init__(self, model: str, base_url: str, timeout_seconds: float) -> None:
        super().__init__(provider_name="ollama", model=model)
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def complete(self, system_prompt: str, user_prompt: str) -> LLMCompletion:
        try:
            import httpx
        except ImportError as exc:  # pragma: no cover - depends on runtime environment
            raise RuntimeError("The httpx package is required for the Ollama provider.") from exc

        payload = {
            "model": self.model,
            "stream": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "options": {"temperature": 0},
        }

        with httpx.Client(timeout=self.timeout_seconds) as client:
            try:
                response = client.post(f"{self.base_url}/api/chat", json=payload)

                if response.status_code >= 400:
                    fallback_payload = dict(payload)
                    fallback_payload.pop("format", None)
                    response = client.post(f"{self.base_url}/api/chat", json=fallback_payload)

                response.raise_for_status()
                body = response.json()
            except Exception as exc:
                raise RuntimeError(f"ollama request failed: {exc}") from exc

        message = body.get("message", {})
        content = message.get("content", "")
        return LLMCompletion(
            content=content.strip(),
            usage=extract_ollama_usage(body),
        )


def get_llm_provider(settings: Settings) -> BaseLLMProvider:
    return build_llm_provider(
        settings=settings,
        provider_name=settings.llm_provider,
        model=settings.resolved_llm_model,
    )


def get_fallback_llm_provider(settings: Settings) -> BaseLLMProvider | None:
    if not settings.fallback_llm_provider:
        return None

    return build_llm_provider(
        settings=settings,
        provider_name=settings.fallback_llm_provider,
        model=settings.resolved_fallback_llm_model,
    )


def build_llm_provider(
    *,
    settings: Settings,
    provider_name: LLMProviderName,
    model: str,
) -> BaseLLMProvider:
    if provider_name == "openai":
        return OpenAICompatibleProvider(
            provider_name="openai",
            model=model,
            api_key=settings.openai_api_key,
        )

    if provider_name == "grok":
        return OpenAICompatibleProvider(
            provider_name="grok",
            model=model,
            api_key=settings.grok_api_key,
            base_url=settings.grok_base_url,
        )

    if provider_name == "groq":
        return OpenAICompatibleProvider(
            provider_name="groq",
            model=model,
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
        )

    if provider_name == "ollama":
        return OllamaProvider(
            model=model,
            base_url=settings.ollama_base_url,
            timeout_seconds=settings.ollama_timeout_seconds,
        )

    raise ValueError(f"Unsupported LLM provider: {provider_name}")
