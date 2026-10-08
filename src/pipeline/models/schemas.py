"""
Pydantic and Dataclass schemas for Bronze and Silver entities.
"""

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any


@dataclass
class BronzeDocument:
    """Represents an unprocessed raw bronze record."""
    raw_id: str
    source_type: str  # 'html_article', 'faq', 'pdf', 'relational_snapshot'
    source_file: str
    title: str | None = None
    url: str | None = None
    category: str | None = None
    domain: str | None = None
    raw_content: str | None = None
    raw_metadata: dict[str, Any] = field(default_factory=dict)
    crawled_at: str | None = None


@dataclass
class SilverDocument:
    """Standardized, normalized, and validated document in Silver layer."""
    doc_id: str
    source_id: str
    source_type: str
    title: str
    category: str
    domain: str | None
    url: str | None
    language: str
    content_clean_markdown: str
    content_plain_text: str
    word_count: int
    char_count: int
    token_estimate: int
    diacritic_ratio: float
    quality_score: float
    checksum_sha256: str
    metadata: dict[str, Any] = field(default_factory=dict)
    processed_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SilverChunk:
    """Semantic chunk with hierarchical breadcrumb context ready for Pre-RAG retrieval and indexing."""
    chunk_id: str
    doc_id: str
    chunk_index: int
    heading_path: list[str]
    heading_context: str
    content: str
    raw_chunk_text: str
    token_estimate: int
    char_count: int
    category: str
    source_type: str
    url: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SilverFAQItem:
    """Extracted and normalized Q&A pair from FAQ accordions."""
    faq_id: str
    question: str
    answer: str
    answer_markdown: str
    category: str
    subcategory: str
    vehicle_tags: list[str]
    source_url: str | None = None
    doc_id: str | None = None
    quality_score: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SilverVehicle:
    """Clean relational vehicle product, pricing, specs, and color configurations."""
    vehicle_id: str
    model_name: str
    vehicle_type: str  # 'car' or 'bike'
    trims: list[dict[str, Any]]
    battery_options: list[dict[str, Any]]
    specifications: dict[str, Any]
    promotions: list[str]
    rolling_costs: dict[str, Any]
    searchable_markdown: str
    colors: list[dict[str, Any]] = field(default_factory=list)
    interior_colors: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SilverReport:
    """Execution statistics and quality audit report for pipeline execution."""
    pipeline_version: str
    started_at: str
    completed_at: str
    elapsed_seconds: float
    total_bronze_records: int
    total_silver_documents: int
    total_silver_chunks: int
    total_faq_items: int
    total_vehicles: int
    duplicates_filtered: int
    low_quality_filtered: int
    language_distribution: dict[str, int]
    source_distribution: dict[str, int]
    category_distribution: dict[str, int]
    average_quality_score: float
    average_token_count_per_chunk: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
