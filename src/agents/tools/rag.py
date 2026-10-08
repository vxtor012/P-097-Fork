"""Vector retrieval over the precomputed Gold embedding corpus."""

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from langchain_core.tools import tool

from src.config import get_settings

EMBEDDING_MODEL = "text-embedding-3-small"
GoldTopic = Literal["bao_gia_chi_phi", "bao_hanh_hau_mai", "chinh_sach_uu_dai",
                  "pin_va_tram_sac", "tai_chinh_tra_gop", "thong_so_va_chon_xe"]
EMBEDDING_FILE = Path(__file__).resolve().parents[3] / "dataset" / "gold" / "vinfast_embeddings.jsonl"


@lru_cache(maxsize=1)
def _load_records() -> tuple[dict[str, Any], ...]:
    if not EMBEDDING_FILE.is_file():
        raise FileNotFoundError(f"Gold embeddings not found: {EMBEDDING_FILE}")

    records = []
    with EMBEDDING_FILE.open(encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            if not line.strip():
                continue
            record = json.loads(line)
            vector = record.get("embedding")
            text = record.get("content") if record.get("record_type") == "chunk" else record.get("searchable_markdown")
            if not isinstance(vector, list) or not text:
                continue
            if record.get("embedding_model") != EMBEDDING_MODEL:
                raise ValueError(f"Unexpected embedding model at line {line_number}")
            if any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in vector):
                continue
            record["_text"] = text
            record["_norm"] = math.sqrt(sum(float(value) ** 2 for value in vector))
            records.append(record)

    if not records:
        raise ValueError(f"No usable embedding records in {EMBEDDING_FILE}")
    return tuple(records)


@lru_cache(maxsize=1)
def _embedding_client():
    settings = get_settings()
    if not settings.openai_api_key.strip():
        raise RuntimeError("OPENAI_API_KEY is required: stored Gold vectors use OpenAI embeddings regardless of llm_provider")
    from langchain_openai import OpenAIEmbeddings

    return OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=settings.openai_api_key)


def _embed_query(query: str) -> list[float]:
    return _embedding_client().embed_query(query)


def _retrieve(query_vector: list[float], top_k: int = 5, category: str | None = None) -> list[dict[str, Any]]:
    query_norm = math.sqrt(sum(float(value) ** 2 for value in query_vector))
    if query_norm == 0:
        return []

    matches = []
    for record in _load_records():
        vector = record["embedding"]
        if len(vector) != len(query_vector) or record["_norm"] == 0:
            continue
        topic = record.get("metadata", {}).get("gold_topic") or record.get("category")
        if category and topic != category:
            continue
        score = sum(float(left) * float(right) for left, right in zip(query_vector, vector)) / (query_norm * record["_norm"])
        matches.append((score, record, topic))

    matches.sort(key=lambda item: item[0], reverse=True)
    return [{
        "record_type": record.get("record_type"),
        "id": record.get("chunk_id") or record.get("vehicle_id"),
        "doc_id": record.get("doc_id"),
        "title": record.get("metadata", {}).get("doc_title") or record.get("model_name"),
        "topic": topic,
        "score": round(score, 4),
        "url": record.get("url"),
        "text": record["_text"][:1600],
    } for score, record, topic in matches[:max(1, min(top_k, 8))]]


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
        query_vector = _embed_query(query)
    except Exception as exc:  # thiếu key/mạng: trả lỗi có cấu trúc
        return json.dumps({"tool": "search_gold_knowledge", "results": [],
                           "error": f"Không tạo được embedding cho truy vấn ({type(exc).__name__}); không có kết quả RAG."},
                          ensure_ascii=False)
    results = _retrieve(query_vector, top_k=top_k, category=category)
    if not results and category:
        results = _retrieve(query_vector, top_k=top_k)  # lọc topic ra 0 kết quả thì thử lại không lọc
    return json.dumps({
        "tool": "search_gold_knowledge",
        "embedding_model": EMBEDDING_MODEL,
        "results": results,
        "notes": ["Kết quả là ngữ cảnh tham khảo; không dùng để thay số liệu giá/phí từ tool cấu trúc."] if results else ["Không tìm thấy nội dung phù hợp trong Gold embeddings."],
    }, ensure_ascii=False)
