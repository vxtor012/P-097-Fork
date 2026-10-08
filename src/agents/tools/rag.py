"""Vector retrieval over the precomputed Gold embedding corpus."""

import json
from functools import lru_cache
from typing import Any, Literal

from langchain_core.tools import tool

from src import ai_data
from src.config import get_settings

EMBEDDING_MODEL = "text-embedding-3-small"
GoldTopic = Literal["bao_gia_chi_phi", "bao_hanh_hau_mai", "chinh_sach_uu_dai",
                  "pin_va_tram_sac", "tai_chinh_tra_gop", "thong_so_va_chon_xe"]


@lru_cache(maxsize=1)
def _embedding_client(model=EMBEDDING_MODEL):
    settings = get_settings()
    if not settings.openai_api_key.strip():
        raise RuntimeError("OPENAI_API_KEY is required: stored Gold vectors use OpenAI embeddings regardless of llm_provider")
    from langchain_openai import OpenAIEmbeddings

    return OpenAIEmbeddings(model=model, api_key=settings.openai_api_key)


def _embed_query(query: str) -> list[float]:
    return _embedding_client(ai_data.active_dataset()["embedding_model"]).embed_query(query)


def _retrieve(query_vector: list[float], top_k: int = 5, category: str | None = None) -> list[dict[str, Any]]:
    return ai_data.retrieve(query_vector, top_k, category)


@tool
def search_gold_knowledge(query: str, top_k: int = 5, category: GoldTopic | None = None) -> str:
    """Search the precomputed VinFast Gold vectors for technical, charging, policy, promotion, and ownership knowledge.

    Use this for explanatory knowledge. For exact trim prices and ownership costs, use the structured catalog tools instead.

    Args:
        query: A focused Vietnamese search query.
        top_k: Number of passages to return, from 1 to 8.
        category: Optional Gold topic filter: bao_gia_chi_phi (price/cost), bao_hanh_hau_mai (warranty/after-sales),
            chinh_sach_uu_dai (promotion policy), pin_va_tram_sac (battery/charging), tai_chinh_tra_gop (financing),
            thong_so_va_chon_xe (specs/choosing a car). Leave null when unsure.
    """
    try:
        with ai_data.dataset_scope():
            query_vector = _embed_query(query)
            results = _retrieve(query_vector, top_k=top_k, category=category)
            if not results and category:
                results = _retrieve(query_vector, top_k=top_k)
    except Exception as exc:
        return json.dumps({"tool": "search_gold_knowledge", "results": [],
                           "error": f"Không truy vấn được dữ liệu AI Supabase ({type(exc).__name__}); kiểm tra kết nối, import và khóa embedding."},
                          ensure_ascii=False)
    return json.dumps({
        "tool": "search_gold_knowledge",
        "embedding_model": EMBEDDING_MODEL,
        "results": results,
        "notes": ["Kết quả là ngữ cảnh tham khảo; không dùng để thay số liệu giá/phí từ tool cấu trúc."] if results else ["Không tìm thấy nội dung phù hợp trong Gold embeddings."],
    }, ensure_ascii=False)
