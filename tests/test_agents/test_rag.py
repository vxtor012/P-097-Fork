import json

from src.agents.tools import rag
from src.agents.tools.vinfast_tools import VINFAST_TOOLS


def test_precomputed_vectors_retrieve_matching_chunk(monkeypatch):
    records = rag._load_records()
    chunk = next(record for record in records if record["record_type"] == "chunk")
    monkeypatch.setattr(rag, "_embed_query", lambda query: chunk["embedding"])

    result = json.loads(rag.search_gold_knowledge.invoke({"query": "thông tin xe", "top_k": 3}))

    assert len(result["results"]) == 3
    assert result["results"][0]["id"] == chunk["chunk_id"]
    assert result["results"][0]["score"] == 1.0
    assert result["embedding_model"] == "text-embedding-3-small"


def test_rag_tool_is_registered_with_agent():
    assert rag.search_gold_knowledge in VINFAST_TOOLS
