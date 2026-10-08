"""
Extractor for HTML articles from crawled websites.
Uses trafilatura with BeautifulSoup fallback.
"""

import json
import logging
from collections.abc import Generator
from pathlib import Path

import trafilatura
from bs4 import BeautifulSoup

from ..models.schemas import BronzeDocument
from .base import BaseExtractor

logger = logging.getLogger(__name__)


class HTMLArticleExtractor(BaseExtractor):
    """Extracts articles and blogs from raw HTML bronze dumps."""

    def __init__(self, bronze_dir: Path):
        self.bronze_dir = Path(bronze_dir)
        self.vinfast_manifest = self.bronze_dir / "vinfast" / "vinfast_sources_manifest.json"
        self.vinfast_articles_dir = self.bronze_dir / "vinfast" / "articles"

        self.web_scraping_manifest = self.bronze_dir / "web_scraping" / "web_scraping_manifest.json"
        self.web_scraping_articles_dir = self.bronze_dir / "web_scraping" / "raw_html"

    def extract_all(self) -> Generator[BronzeDocument, None, None]:
        """Extract articles from both VinFast and general web scraping bronze sources."""
        # 1. Vinfast articles
        yield from self._extract_manifest_articles(
            manifest_path=self.vinfast_manifest,
            articles_dir=self.vinfast_articles_dir,
            default_category="chinh_sach_uu_dai",
            default_domain="vinfastauto.com",
        )

        # 2. Web scraping articles (Techcombank, BaoViet, Xehay)
        yield from self._extract_manifest_articles(
            manifest_path=self.web_scraping_manifest,
            articles_dir=self.web_scraping_articles_dir,
            default_category="web_scraping",
            default_domain="web",
        )

    def _extract_manifest_articles(
        self,
        manifest_path: Path,
        articles_dir: Path,
        default_category: str,
        default_domain: str,
    ) -> Generator[BronzeDocument, None, None]:
        if not articles_dir.exists():
            return

        entries: list[dict] = []
        if manifest_path.exists():
            try:
                with open(manifest_path, encoding="utf-8") as f:
                    entries = json.load(f)
            except Exception as e:
                logger.error("Failed to load manifest %s: %s", manifest_path, e)
                return
        else:
            # Fallback: discover HTML files in directory directly
            for html_file in sorted(articles_dir.glob("*.html")):
                entries.append({
                    "file": html_file.name,
                    "title": html_file.stem.replace("_", " ").title(),
                    "category": default_category,
                    "domain": default_domain,
                })

        for item in entries:
            file_name = item.get("file")
            if not file_name:
                continue

            file_path = articles_dir / file_name
            if not file_path.exists():
                # Some filenames might need searching or alternate matching
                continue

            try:
                with open(file_path, encoding="utf-8", errors="ignore") as f:
                    html_content = f.read()

                # Extract markdown using trafilatura
                extracted_md = trafilatura.extract(
                    html_content,
                    output_format="markdown",
                    include_tables=True,
                    include_links=False,
                )

                title = item.get("title", "")

                # Fallback to BeautifulSoup if trafilatura extracted insufficient text
                if not extracted_md or len(extracted_md.strip()) < 100:
                    extracted_md = self._extract_with_bs4(html_content, title)

                if not extracted_md or not extracted_md.strip():
                    continue

                # Ensure title heading exists at the top
                if title and not extracted_md.startswith("#"):
                    extracted_md = f"# {title}\n\n{extracted_md}"

                doc = BronzeDocument(
                    raw_id=f"html_{item.get('domain', default_domain)}_{file_name}",
                    source_type="html_article",
                    source_file=str(file_path),
                    title=title,
                    url=item.get("url"),
                    category=item.get("category", default_category),
                    domain=item.get("domain", default_domain),
                    raw_content=extracted_md,
                    raw_metadata=item,
                    crawled_at=item.get("crawled_at"),
                )
                yield doc

            except Exception as e:
                logger.error("Error extracting file %s: %s", file_path, e)

    def _extract_with_bs4(self, html: str, fallback_title: str = "") -> str:
        """Fallback HTML cleaner using BeautifulSoup."""
        soup = BeautifulSoup(html, "html.parser")

        # Remove script, style, nav, footer, header tags
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg", "form"]):
            tag.decompose()

        # Try to locate main article container
        article_el = (
            soup.find("article")
            or soup.find(class_=lambda c: c and any(k in str(c).lower() for k in ["article", "content", "post-body", "detail"]))
            or soup.find("main")
            or soup.body
        )

        if not article_el:
            return ""

        paragraphs = [p.get_text(strip=True) for p in article_el.find_all(["h1", "h2", "h3", "p", "li"])]
        return "\n\n".join([p for p in paragraphs if len(p) > 20])
