"""
Hierarchical context-aware chunker.
Implements heading hierarchy tracking, breadcrumb contextualization,
redundancy elimination, and Vietnamese sentence boundary awareness.
"""

import re
from typing import Any

from ..models.schemas import SilverChunk
from ..nlp.sentence_splitter import VietnameseSentenceSplitter

CAR_MODELS = [
    "VF 3", "VF 5", "VF 6", "VF 7", "VF 8", "VF 9",
    "EC Van", "Herio Green", "Limo Green", "Minio Green", "Nerio Green",
    "VF MPV 7", "VF Wild"
]


class HierarchicalChunker:
    """
    Chunks documents while tracking Markdown heading hierarchy.
    Constructs clean, informative breadcrumbs and enriched metadata for high-precision retrieval.
    """

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 60,
        min_chunk_length: int = 35,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_length = min_chunk_length
        self.sentence_splitter = VietnameseSentenceSplitter()
        self.header_regex = re.compile(r"^(#{1,6})\s+(.+)$")
        # Match legal headings like 'Chương I', 'Điều 12'
        self.legal_heading_regex = re.compile(
            r"^(Chương\s+[IVXLCDM\d]+.*?|Điều\s+\d+\..*?|Mục\s+\d+.*?)$",
            re.IGNORECASE,
        )

    def _clean_heading_title(self, raw_title: str) -> str:
        """Removes editorial brackets and tag prefixes from heading titles."""
        t = raw_title.strip()
        # Remove [ĐÁNH GIÁ XE], [REVIEW], [TỔNG HỢP] etc.
        t = re.sub(r"^\[.*?\]\s*", "", t)
        # Remove trailing source tags like *(Otoxemay)* or (XeHay)
        t = re.sub(r"\s*(\*\([^)]*\)\*|\([^)]*\))\s*$", "", t)
        # Remove bold formatting inside headings: **Heading** -> Heading
        t = re.sub(r"^\*\*(.*?)\*\*$", r"\1", t).strip()
        return t or raw_title.strip()

    def _clean_section_text(self, text: str, last_heading: str) -> str:
        """Removes redundant leading header repeats and noisy whitespace from section text."""
        cleaned = text.strip()
        if not cleaned:
            return ""

        # If the block starts with **Last Heading** or identical text, strip it
        if last_heading:
            clean_h = self._clean_heading_title(last_heading)
            # Match exact bold or plain leading duplicate heading
            patterns = [
                rf"^\*\*{re.escape(clean_h)}\*\*\s*",
                rf"^\*\*{re.escape(last_heading)}\*\*\s*",
                rf"^#{1,6}\s+{re.escape(clean_h)}\s*",
                rf"^#{1,6}\s+{re.escape(last_heading)}\s*",
            ]
            for p in patterns:
                cleaned = re.sub(p, "", cleaned, flags=re.IGNORECASE).strip()

        # Collapse excessive newlines
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

        # Collapse anomalous identical consecutive word repetitions (e.g. 'Có Có Có Có' -> 'Có', '2 2 2 2' -> '2')
        cleaned = re.sub(r"\b(\w+)(?:\s+\1){2,}\b", r"\1", cleaned, flags=re.IGNORECASE)

        # Remove orphaned sequences of 3+ detached boolean/status tokens from broken PDF matrix layers
        cleaned = re.sub(r"(?:\b(?:Có|Không|co|khong|opt|n/a|\d{1,2})\b[\s,;]*){3,}", " ", cleaned, flags=re.IGNORECASE)

        return cleaned.strip()

    def _detect_car_models(self, text: str) -> list[str]:
        """Detects mentioned VinFast electric car models."""
        found = []
        for m in CAR_MODELS:
            pattern = rf"\b{re.escape(m)}\b"
            if re.search(pattern, text, re.IGNORECASE):
                found.append(m)
        return found

    def _parse_sections(self, markdown_text: str, doc_title: str | None = None) -> list[tuple[list[str], str]]:
        """
        Parses markdown text into sections, tracking heading hierarchy.
        Returns a list of (clean_heading_path, block_text).
        """
        lines = markdown_text.split("\n")
        sections: list[tuple[list[str], str]] = []

        # Current stack of headings: list of (level, heading_text)
        heading_stack: list[tuple[int, str]] = []
        current_block_lines: list[str] = []

        def flush_current_block():
            nonlocal current_block_lines
            text = "\n".join(current_block_lines).strip()
            if text:
                raw_path = [h[1] for h in heading_stack]
                # If doc_title provided and not at root, prepend cleaned doc_title
                if doc_title and (not raw_path or self._clean_heading_title(raw_path[0]).lower() != doc_title.lower()):
                    final_path = [doc_title] + [self._clean_heading_title(h) for h in raw_path]
                else:
                    final_path = [self._clean_heading_title(h) for h in raw_path]

                # Deduplicate consecutive identical headings in path
                dedup_path: list[str] = []
                for p in final_path:
                    if not dedup_path or p.lower() != dedup_path[-1].lower():
                        dedup_path.append(p)

                sections.append((dedup_path, text))
            current_block_lines = []

        i = 0
        in_code_block = False

        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            if stripped.startswith("```"):
                in_code_block = not in_code_block
                current_block_lines.append(line)
                i += 1
                continue

            if in_code_block:
                current_block_lines.append(line)
                i += 1
                continue

            # Check for Markdown heading: '# Title', '## Section'
            header_match = self.header_regex.match(stripped)
            if header_match:
                flush_current_block()
                level = len(header_match.group(1))
                title = header_match.group(2).strip()

                while heading_stack and heading_stack[-1][0] >= level:
                    heading_stack.pop()

                heading_stack.append((level, title))
                i += 1
                continue

            # Check for legal doc chapter / article heading
            legal_match = self.legal_heading_regex.match(stripped)
            if legal_match and len(stripped) < 80:
                flush_current_block()
                title = legal_match.group(1).strip()
                level = 2 if title.lower().startswith("chương") else 3

                while heading_stack and heading_stack[-1][0] >= level:
                    heading_stack.pop()

                heading_stack.append((level, title))
                i += 1
                continue

            current_block_lines.append(line)
            i += 1

        flush_current_block()
        return sections

    def chunk_document(
        self,
        doc_id: str,
        markdown_text: str,
        category: str = "general",
        source_type: str = "document",
        url: str | None = None,
        doc_title: str | None = None,
        extra_metadata: dict[str, Any] | None = None,
    ) -> list[SilverChunk]:
        """
        Splits markdown document into semantic chunks with clean breadcrumbs and rich metadata.
        """
        clean_doc_title = self._clean_heading_title(doc_title) if doc_title else None
        sections = self._parse_sections(markdown_text, doc_title=clean_doc_title)
        chunks: list[SilverChunk] = []
        chunk_idx = 0

        for heading_path, raw_section_text in sections:
            last_h = heading_path[-1] if heading_path else ""
            section_text = self._clean_section_text(raw_section_text, last_h)
            if not section_text or len(section_text) < self.min_chunk_length:
                continue

            breadcrumb = " > ".join(heading_path) if heading_path else (clean_doc_title or "")
            is_table = any(line.strip().startswith("|") for line in section_text.split("\n"))

            # Build semantic content without repetitive bracket noise
            def format_chunk_content(text: str) -> str:
                if breadcrumb:
                    return f"[Ngữ cảnh: {breadcrumb}]\n{text}"
                return text

            # Detect models from title, breadcrumb, and text
            full_context_str = f"{breadcrumb} {section_text}"
            models_detected = self._detect_car_models(full_context_str)
            primary_model = models_detected[0] if len(models_detected) == 1 else ("Nhiều dòng xe" if len(models_detected) > 1 else None)

            base_meta = {
                "doc_title": clean_doc_title,
                "car_models": models_detected,
                "primary_model": primary_model,
                "section_depth": len(heading_path),
                "has_table": is_table,
            }
            if extra_metadata:
                base_meta.update(extra_metadata)

            # Keep as single chunk if within size or table
            if len(section_text) <= self.chunk_size or is_table:
                full_content = format_chunk_content(section_text)
                chunk = SilverChunk(
                    chunk_id=f"{doc_id}_{chunk_idx}",
                    doc_id=doc_id,
                    chunk_index=chunk_idx,
                    heading_path=heading_path,
                    heading_context=breadcrumb,
                    content=full_content,
                    raw_chunk_text=section_text,
                    token_estimate=len(full_content.split()),
                    char_count=len(full_content),
                    category=category,
                    source_type=source_type,
                    url=url,
                    metadata=base_meta.copy(),
                )
                chunks.append(chunk)
                chunk_idx += 1
                continue

            # Split by Vietnamese sentences with smooth non-duplicative window
            sentences = self.sentence_splitter.split_sentences(section_text)
            current_chunk_sentences: list[str] = []
            current_len = 0

            s_idx = 0
            while s_idx < len(sentences):
                sentence = sentences[s_idx]
                sentence_len = len(sentence)

                if current_len + sentence_len > self.chunk_size and current_chunk_sentences:
                    raw_text = " ".join(current_chunk_sentences).strip()
                    if len(raw_text) >= self.min_chunk_length:
                        full_content = format_chunk_content(raw_text)
                        chunk = SilverChunk(
                            chunk_id=f"{doc_id}_{chunk_idx}",
                            doc_id=doc_id,
                            chunk_index=chunk_idx,
                            heading_path=heading_path,
                            heading_context=breadcrumb,
                            content=full_content,
                            raw_chunk_text=raw_text,
                            token_estimate=len(full_content.split()),
                            char_count=len(full_content),
                            category=category,
                            source_type=source_type,
                            url=url,
                            metadata=base_meta.copy(),
                        )
                        chunks.append(chunk)
                        chunk_idx += 1

                    # Compute overlap (max 1 previous sentence or small window)
                    overlap_sentences: list[str] = []
                    overlap_len = 0
                    if current_chunk_sentences:
                        last_sentence = current_chunk_sentences[-1]
                        if len(last_sentence) <= self.chunk_overlap:
                            overlap_sentences.append(last_sentence)
                            overlap_len = len(last_sentence)

                    current_chunk_sentences = overlap_sentences
                    current_len = overlap_len

                current_chunk_sentences.append(sentence)
                current_len += sentence_len
                s_idx += 1

            if current_chunk_sentences:
                raw_text = " ".join(current_chunk_sentences).strip()
                if len(raw_text) >= self.min_chunk_length:
                    full_content = format_chunk_content(raw_text)
                    chunk = SilverChunk(
                        chunk_id=f"{doc_id}_{chunk_idx}",
                        doc_id=doc_id,
                        chunk_index=chunk_idx,
                        heading_path=heading_path,
                        heading_context=breadcrumb,
                        content=full_content,
                        raw_chunk_text=raw_text,
                        token_estimate=len(full_content.split()),
                        char_count=len(full_content),
                        category=category,
                        source_type=source_type,
                        url=url,
                        metadata=base_meta.copy(),
                    )
                    chunks.append(chunk)
                    chunk_idx += 1

        return chunks
