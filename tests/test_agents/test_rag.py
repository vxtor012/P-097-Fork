import json

from src.agents.tools import rag
from src.agents.tools.vinfast_tools import VINFAST_TOOLS


def test_precomputed_vectors_retrieve_matching_chunk(monkeypatch):
    monkeypatch.setattr(rag, "_embed_query", lambda query: [1.0] + [0.0] * 1535)
    monkeypatch.setattr(rag.ai_data, "retrieve", lambda vector, top_k, category: [
        {"id": "test-chunk", "score": 1.0}, {"id": "second", "score": 0.8}, {"id": "third", "score": 0.0}
    ])

    result = json.loads(rag.search_gold_knowledge.invoke({"query": "thông tin xe", "top_k": 3}))

    assert len(result["results"]) == 3
    assert result["results"][0]["id"] == "test-chunk"
    assert result["results"][0]["score"] == 1.0
    assert result["embedding_model"] == "text-embedding-3-small"


def test_rag_tool_is_registered_with_agent():
    assert rag.search_gold_knowledge in VINFAST_TOOLS
