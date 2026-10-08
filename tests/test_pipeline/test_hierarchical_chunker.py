"""Unit tests for Hierarchical Chunker."""

from src.pipeline.chunking.hierarchical_chunker import HierarchicalChunker


def test_breadcrumb_preservation():
    chunker = HierarchicalChunker(chunk_size=200, chunk_overlap=30)
    markdown = """
# VinFast VF 8
## Chính sách bảo hành
Bảo hành xe 10 năm hoặc 200.000 km tùy điều kiện nào đến trước.
Pin được bảo hành 10 năm không giới hạn số km.
"""
    chunks = chunker.chunk_document(doc_id="test_doc", markdown_text=markdown)
    assert len(chunks) >= 1
    # Check that the chunk contains breadcrumb context
    assert "VinFast VF 8 > Chính sách bảo hành" in chunks[0].heading_context
    assert "VinFast VF 8 > Chính sách bảo hành" in chunks[0].content


def test_table_kept_intact():
    chunker = HierarchicalChunker(chunk_size=300, chunk_overlap=30)
    markdown = """
# Bảng giá xe
| Dòng xe | Phiên bản | Giá niêm yết |
|---|---|---|
| VF 3 | Eco | 285.000.000 đ |
| VF 5 | Plus | 540.000.000 đ |
"""
    chunks = chunker.chunk_document(doc_id="test_table", markdown_text=markdown)
    assert len(chunks) == 1
    assert "| VF 3 | Eco |" in chunks[0].content
    assert "| VF 5 | Plus |" in chunks[0].content


def test_car_model_detection_and_clean_metadata():
    chunker = HierarchicalChunker(chunk_size=400, chunk_overlap=30)
    markdown = """
# Đánh giá xe VinFast VF 8 thế hệ mới
## Động cơ & Khả năng vận hành
Mô-tơ điện trên VinFast VF 8 cho công suất tối đa 228 mã lực, phản hồi mượt mà trong phố.
"""
    chunks = chunker.chunk_document(doc_id="test_vf8", markdown_text=markdown, doc_title="Đánh giá VinFast VF 8")
    assert len(chunks) >= 1
    chunk = chunks[0]
    assert "VF 8" in chunk.metadata["car_models"]
    assert chunk.metadata["primary_model"] == "VF 8"
    assert chunk.metadata["doc_title"] == "Đánh giá VinFast VF 8"
    assert "Đánh giá xe VinFast VF 8 thế hệ mới > Động cơ & Khả năng vận hành" in chunk.heading_context


def test_heading_deduplication_and_no_bracket_noise():
    chunker = HierarchicalChunker(chunk_size=400, chunk_overlap=30)
    markdown = """
# [REVIEW] VinFast VF 9
## [REVIEW] VinFast VF 9
### Thiết kế nội thất
Khoang cabin VF 9 sở hữu 3 hàng ghế bọc da cao cấp vô cùng rộng rãi.
"""
    chunks = chunker.chunk_document(doc_id="test_noise", markdown_text=markdown)
    assert len(chunks) >= 1
    chunk = chunks[0]
    # Brackets [REVIEW] should be stripped and duplicate headers collapsed
    assert "[REVIEW]" not in chunk.heading_context
    assert chunk.heading_path == ["VinFast VF 9", "Thiết kế nội thất"]
    assert chunk.heading_context == "VinFast VF 9 > Thiết kế nội thất"
