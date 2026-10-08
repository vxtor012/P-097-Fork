"""
Crawlers and Ingestion module for Vietnamese Automotive Pre-RAG Pipeline.
"""

from .raw_crawler import CrawlReport, RawCrawler
from .url_discoverer import SEED_ENTRIES, UrlDiscoverer

__all__ = [
    "UrlDiscoverer",
    "SEED_ENTRIES",
    "RawCrawler",
    "CrawlReport",
]
