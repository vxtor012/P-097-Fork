"""Integration tests for Bronze-to-Silver Pipeline."""

import json

from src.pipeline.bronze_to_silver import BronzeToSilverPipeline
from src.pipeline.config import PipelineConfig


def test_pipeline_execution(tmp_path):
    # Run pipeline with temporary silver output
    config = PipelineConfig(silver_dir=tmp_path / "silver")
    pipeline = BronzeToSilverPipeline(config=config)
    report = pipeline.run()

    assert report.total_bronze_records > 0
    assert report.total_silver_documents > 0
    assert report.total_silver_chunks > 0
    assert report.total_vehicles > 0
    assert report.average_quality_score > 0.0

    # Verify generated files
    assert (config.silver_dir / "silver_documents.jsonl").exists()
    assert (config.silver_dir / "silver_chunks.jsonl").exists()
    assert (config.silver_dir / "silver_faq.jsonl").exists()
    assert (config.silver_dir / "silver_vehicles.jsonl").exists()
    assert (config.silver_dir / "silver_report.json").exists()

    with open(config.silver_dir / "silver_faq.jsonl", encoding="utf-8") as f:
        faq_count = sum(1 for line in f if line.strip())
    assert report.total_faq_items == faq_count

    # Verify report JSON content
    with open(config.silver_dir / "silver_report.json", encoding="utf-8") as f:
        report_data = json.load(f)
    assert report_data["total_faq_items"] == faq_count
