from typing import Any

from src.config import get_settings

_llm: Any = None


def set_llm(llm: Any) -> None:
    """Inject a fake chat model in tests without making API calls."""
    global _llm
    _llm = llm


def get_llm() -> Any:
    global _llm
    if _llm is not None:
        return _llm

    settings = get_settings()
    provider = settings.llm_provider
    if provider == "auto":
        openai_key = settings.openai_api_key.strip()
        google_key = settings.google_api_key.strip()
        has_openai_key = len(openai_key) > 20 and not openai_key.startswith("sk-your-key")
        has_google_key = len(google_key) > 20 and not google_key.lower().startswith("your-")
        if has_openai_key:
            provider = "openai"
        elif has_google_key:
            provider = "google"
        else:
            raise RuntimeError("Configure OPENAI_API_KEY or GOOGLE_API_KEY")

    if provider == "openai":
        if not settings.openai_api_key.strip():
            raise RuntimeError("OPENAI_API_KEY is not configured")
        from langchain_openai import ChatOpenAI

        _llm = ChatOpenAI(
            model=settings.model_name,
            api_key=settings.openai_api_key,
            temperature=settings.llm_temperature,
        )
    else:
        if not settings.google_api_key.strip():
            raise RuntimeError("GOOGLE_API_KEY is not configured")
        from langchain_google_genai import ChatGoogleGenerativeAI

        _llm = ChatGoogleGenerativeAI(
            model=settings.google_model_name,
            google_api_key=settings.google_api_key,
            temperature=settings.llm_temperature,
        )
    return _llm
