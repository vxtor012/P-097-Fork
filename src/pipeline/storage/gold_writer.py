"""
Gold dataset writer.
Saves filtered, consultation-specialized Gold artifacts, topic partitions, and audit reports.
"""

import json
import logging
from pathlib import Path
from typing import Any

from ..models.schemas import (
    SilverChunk,
    SilverDocument,
    SilverFAQItem,
    SilverVehicle,
)

logger = logging.getLogger(__name__)


class GoldWriter:
    """Manages the persistence of clean, specialized Gold data layers and topic partitions."""

    def __init__(self, gold_dir: Path):
        self.gold_dir = Path(gold_dir)
        self.gold_dir.mkdir(parents=True, exist_ok=True)
        self.by_topic_dir = self.gold_dir / "by_topic"
        self.by_topic_dir.mkdir(parents=True, exist_ok=True)

    def write_documents(self, documents: list[SilverDocument]) -> Path:
        """Writes Gold documents to gold_documents.jsonl."""
        out_path = self.gold_dir / "gold_documents.jsonl"
        with open(out_path, "w", encoding="utf-8") as f:
            for doc in documents:
                f.write(json.dumps(doc.to_dict(), ensure_ascii=False) + "\n")
        logger.info("Saved %d Gold documents to %s", len(documents), out_path)
        return out_path

    def write_chunks(self, chunks: list[SilverChunk]) -> Path:
        """Writes Gold chunks to gold_chunks.jsonl."""
        out_path = self.gold_dir / "gold_chunks.jsonl"
        with open(out_path, "w", encoding="utf-8") as f:
            for chunk in chunks:
                f.write(json.dumps(chunk.to_dict(), ensure_ascii=False) + "\n")
        logger.info("Saved %d Gold chunks to %s", len(chunks), out_path)
        return out_path

    def write_topics(self, chunks: list[SilverChunk]) -> dict[str, Any]:
        """
        Partitions Gold chunks into separate topic-specific datasets under dataset/gold/by_topic/.
        Creates {topic}.jsonl for each consultation domain.
        """
        topic_groups: dict[str, list[SilverChunk]] = {}
        for chunk in chunks:
            topic = chunk.metadata.get("gold_topic") or "thong_so_va_chon_xe"
            topic_groups.setdefault(topic, []).append(chunk)

        topic_stats: dict[str, Any] = {}
        for topic, topic_chunks in sorted(topic_groups.items()):
            topic_file = self.by_topic_dir / f"{topic}.jsonl"
            with open(topic_file, "w", encoding="utf-8") as f:
                for c in topic_chunks:
                    f.write(json.dumps(c.to_dict(), ensure_ascii=False) + "\n")

            models = set()
            for c in topic_chunks:
                for m in c.metadata.get("car_models", []):
                    models.add(m)

            topic_stats[topic] = {
                "file": f"dataset/gold/by_topic/{topic}.jsonl",
                "total_chunks": len(topic_chunks),
                "total_tokens": sum(c.token_estimate for c in topic_chunks),
                "car_models_covered": sorted(models),
                "unique_docs_count": len(set(c.doc_id for c in topic_chunks)),
            }

        # Save topic summary manifest
        summary_path = self.by_topic_dir / "topic_summary.json"
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(topic_stats, f, ensure_ascii=False, indent=2)

        logger.info("Partitioned Gold chunks into %d topic datasets in %s", len(topic_groups), self.by_topic_dir)
        return topic_stats

    def write_faq_items(self, faq_items: list[SilverFAQItem]) -> Path:
        """Writes Gold FAQ items to gold_faq.jsonl."""
        out_path = self.gold_dir / "gold_faq.jsonl"
        with open(out_path, "w", encoding="utf-8") as f:
            for item in faq_items:
                f.write(json.dumps(item.to_dict(), ensure_ascii=False) + "\n")
        logger.info("Saved %d Gold FAQ items to %s", len(faq_items), out_path)
        return out_path

    def write_vehicles(self, vehicles: list[SilverVehicle]) -> Path:
        """Writes Gold vehicles to gold_vehicles.jsonl."""
        out_path = self.gold_dir / "gold_vehicles.jsonl"
        with open(out_path, "w", encoding="utf-8") as f:
            for v in vehicles:
                f.write(json.dumps(v.to_dict(), ensure_ascii=False) + "\n")
        logger.info("Saved %d Gold vehicles to %s", len(vehicles), out_path)
        return out_path

    def write_report(self, report_dict: dict[str, Any]) -> Path:
        """Writes audit metrics to gold_report.json and generates gold README.md."""
        out_path = self.gold_dir / "gold_report.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=2)
        logger.info("Saved Gold pipeline report to %s", out_path)

        # Automatically generate dataset/gold/README.md
        try:
            from .readme_generator import generate_gold_readme
            readme_path = generate_gold_readme(self.gold_dir, report_dict)
            logger.info("Generated Gold README at %s", readme_path)
        except Exception as e:
            logger.warning("Failed to generate Gold README: %s", e)

        return out_path

    def write_readme(self, report_dict: dict[str, Any]) -> Path:
        """Explicitly generates dataset/gold/README.md."""
        from .readme_generator import generate_gold_readme
        return generate_gold_readme(self.gold_dir, report_dict)

    def write_rdb_schema(self, tables: dict[str, list[dict[str, Any]]]) -> Path:
        """Writes structured relational tables as CSV files into rdb_schema/."""
        import csv
        rdb_dir = self.gold_dir / "rdb_schema"
        rdb_dir.mkdir(parents=True, exist_ok=True)

        for table_name, rows in tables.items():
            if not rows:
                continue
            csv_path = rdb_dir / f"{table_name}.csv"
            fieldnames = list(rows[0].keys())
            with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            logger.info("Saved %d rows to %s", len(rows), csv_path)

        return rdb_dir
