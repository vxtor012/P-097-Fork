"""
Base extractor interface.
"""

from abc import ABC, abstractmethod
from collections.abc import Generator

from ..models.schemas import BronzeDocument


class BaseExtractor(ABC):
    """Abstract interface for bronze data source extractors."""

    @abstractmethod
    def extract_all(self) -> Generator[BronzeDocument, None, None]:
        """Extract all bronze records from source directory or manifest."""
        pass
