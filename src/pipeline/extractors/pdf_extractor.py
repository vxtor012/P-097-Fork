"""
PDF extractor for Vietnamese legal, technical, and promotional documents.
Uses PyMuPDF to extract text, detect document structures, and clean page noise.
"""

import json
import logging
import os
import re
from collections.abc import Generator
from pathlib import Path

import pymupdf

from ..models.schemas import BronzeDocument
from .base import BaseExtractor

logger = logging.getLogger(__name__)


class PDFExtractor(BaseExtractor):
    """Extracts text and hierarchical headings from Vietnamese PDF documents."""

    def __init__(self, pdf_dir: Path):
        self.pdf_dir = Path(pdf_dir)
        self.manifest_path = self.pdf_dir / "pdf_manifest.json"

        # Suppress benign MuPDF C-level syntax warnings (e.g. missing shading colorspace)
        try:
            pymupdf.TOOLS.mupdf_display_errors(False)
        except Exception:
            pass

        # Regex for page numbering noise: 'Trang 1 / 10', 'Page 2 of 5', '- 3 -'
        self.page_number_regex = re.compile(
            r"^(Trang\s+\d+(\s*/\s*\d+)?|Page\s+\d+(\s*of\s*\d+)?|-\s*\d+\s*-|\d+/\d+)$",
            re.IGNORECASE,
        )
        # Regex for browser print header/footer noise: '9/30/26, 12:16 PM about: blank'
        self.print_noise_regex = re.compile(
            r"(\d{1,2}/\d{1,2}/\d{2,4},\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*about:\s*blank|about:\s*blank)",
            re.IGNORECASE,
        )

        # Regex for legal / policy headers
        self.chapter_regex = re.compile(r"^(Chương\s+[IVXLCDM\d]+[^\n]*)$", re.IGNORECASE)
        self.article_regex = re.compile(r"^(Điều\s+\d+\.[^\n]*)$", re.IGNORECASE)

    def extract_all(self) -> Generator[BronzeDocument, None, None]:
        """Iterates over manifest items and extracts documents."""
        if not self.manifest_path.exists():
            logger.warning("PDF manifest missing at %s", self.manifest_path)
            return

        try:
            with open(self.manifest_path, encoding="utf-8") as f:
                entries = json.load(f)
        except Exception as e:
            logger.error("Failed to read PDF manifest: %s", e)
            return

        for item in entries:
            rel_path = item.get("relative_path", "")
            fname = os.path.basename(rel_path)
            category = item.get("category", "general")
            file_path = self.pdf_dir / category / fname

            if not file_path.exists():
                # Try relative to pdf_dir without category
                file_path = self.pdf_dir / fname
                if not file_path.exists():
                    continue

            try:
                extracted_md = self._extract_pdf_content(file_path, item.get("title", ""))
                if not extracted_md or len(extracted_md.strip()) < 100:
                    continue

                title = item.get("title") or fname.replace(".pdf", "").replace("_", " ").title()
                raw_id = f"pdf_{category}_{fname}"

                yield BronzeDocument(
                    raw_id=raw_id,
                    source_type="pdf",
                    source_file=str(file_path),
                    title=title,
                    url=None,
                    category=category,
                    domain="local_pdf",
                    raw_content=extracted_md,
                    raw_metadata=item,
                )

            except Exception as e:
                logger.error("Error reading PDF %s: %s", file_path, e)

    def _extract_pdf_content(self, file_path: Path, doc_title: str) -> str | None:
        """Extracts text and tables page-by-page, strips page noise, and structures markdown."""
        try:
            with pymupdf.open(str(file_path)) as doc:
                num_pages = len(doc)
                if num_pages == 0:
                    return None

                markdown_sections = []
                if doc_title:
                    markdown_sections.append(f"# {doc_title}")

                # For brochures, policies, and spec sheets (<= 30 pages), run full table reconstruction
                # For heavy legal documents (> 30 pages), run fast line extraction
                is_short_or_brochure = num_pages <= 30

                for page_idx in range(num_pages):
                    page = doc[page_idx]

                    if is_short_or_brochure:
                        # 1. Detect and extract structured tables
                        try:
                            table_finder = page.find_tables()
                            tables = table_finder.tables if table_finder else []
                        except Exception:
                            tables = []

                        table_rects = [pymupdf.Rect(t.bbox) for t in tables]
                        page_items: list[tuple[float, str, str]] = []  # (y0, type, content)

                        for tab in tables:
                            try:
                                md_table = tab.to_markdown().strip()
                                if md_table:
                                    page_items.append((tab.bbox[1], "table", md_table))
                            except Exception:
                                pass

                        # 2. Extract text blocks not inside table bounding boxes
                        try:
                            blocks = page.get_text("blocks")
                        except Exception:
                            blocks = []

                        for b in blocks:
                            if len(b) < 5 or b[6] != 0:  # 0 is text block
                                continue

                            r = pymupdf.Rect(b[:4])
                            if any(r.intersects(tr) for tr in table_rects):
                                continue

                            raw_text = b[4].strip()
                            if not raw_text:
                                continue

                            processed_lines = []
                            for line in raw_text.split("\n"):
                                stripped = line.strip()
                                if not stripped:
                                    continue

                                if self.page_number_regex.match(stripped):
                                    continue

                                if self.print_noise_regex.search(stripped):
                                    stripped = self.print_noise_regex.sub("", stripped).strip()
                                    if not stripped:
                                        continue

                                if self.chapter_regex.match(stripped):
                                    processed_lines.append(f"\n## {stripped}\n")
                                    continue

                                if self.article_regex.match(stripped):
                                    processed_lines.append(f"\n### {stripped}\n")
                                    continue

                                processed_lines.append(stripped)

                            if processed_lines:
                                block_md = "\n".join(processed_lines).strip()
                                page_items.append((b[1], "text", block_md))

                        # Sort items by vertical position y0 and assemble page
                        page_items.sort(key=lambda item: item[0])
                        page_content = "\n\n".join(item[2] for item in page_items).strip()
                        if page_content:
                            markdown_sections.append(page_content)

                    else:
                        # Fast path for long legal codes
                        page_text = page.get_text("text")
                        if not page_text or not page_text.strip():
                            continue

                        lines = page_text.split("\n")
                        processed_lines = []
                        for line in lines:
                            stripped = line.strip()
                            if not stripped:
                                continue

                            if self.page_number_regex.match(stripped):
                                continue

                            if self.print_noise_regex.search(stripped):
                                stripped = self.print_noise_regex.sub("", stripped).strip()
                                if not stripped:
                                    continue

                            if self.chapter_regex.match(stripped):
                                processed_lines.append(f"\n## {stripped}\n")
                                continue

                            if self.article_regex.match(stripped):
                                processed_lines.append(f"\n### {stripped}\n")
                                continue

                            processed_lines.append(stripped)

                        if processed_lines:
                            markdown_sections.append("\n".join(processed_lines).strip())

                return "\n\n".join(markdown_sections).strip()
        except Exception as e:
            logger.error("Failed parsing PDF content from %s: %s", file_path, e)
            return None
