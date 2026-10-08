"""Allowlisted web lookup for vehicle details absent from the Supabase catalog."""

import json
import re
import unicodedata
import urllib.request
from html.parser import HTMLParser
from urllib.parse import urlparse

from langchain_core.tools import tool

from src import ai_data

MAX_RESPONSE_BYTES = 1_500_000
SKIP_TAGS = {"script", "style", "nav", "header", "footer", "noscript", "form", "svg"}
BLOCK_TAGS = {"p", "li", "div", "br", "h1", "h2", "h3", "h4", "section", "article"}


class _TextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lines: list[str] = []
        self._buffer: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self._skip_depth += 1
        elif not self._skip_depth and tag in BLOCK_TAGS:
            self._flush()

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
        elif not self._skip_depth and tag in BLOCK_TAGS:
            self._flush()

    def handle_data(self, data):
        if not self._skip_depth:
            self._buffer.append(data)

    def close(self):
        super().close()
        self._flush()

    def _flush(self):
        line = re.sub(r"\s+", " ", " ".join(self._buffer)).strip()
        self._buffer.clear()
        if line and (not self.lines or line != self.lines[-1]):
            self.lines.append(line)


def _load_source_config() -> dict:
    return ai_data.web_sources()


def _host_allowed(url: str, domains: list[str]) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and any(host == domain or host.endswith("." + domain) for domain in domains)


STOP_TERMS = {"mau", "cua", "cho", "voi", "xe", "la", "co", "va", "nhu", "the"}


def _fold(text: str | None) -> str:
    """Bỏ dấu tiếng Việt, hạ chữ thường, giữ khoảng trắng giữa các từ."""
    text = unicodedata.normalize("NFKD", (text or "").replace("đ", "d").replace("Đ", "D"))
    return "".join(char for char in text if not unicodedata.combining(char)).lower()


def _normalize(text: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", _fold(text))


def _topic_terms(topic: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", _fold(topic))
    terms = [word for word in dict.fromkeys(words) if len(word) >= 2 and word not in STOP_TERMS]
    return terms or ["noi", "that", "ghe", "chat", "lieu"]


def _line_hits(line: str, terms: list[str]) -> int:
    folded = _fold(line)
    tokens = set(re.findall(r"[a-z0-9]+", folded))
    return sum(1 for term in terms if term in tokens or (len(term) >= 4 and term in folded))


def _fetch_page(url: str, domains: list[str]) -> str:
    if not _host_allowed(url, domains):
        raise ValueError("Nguồn không thuộc allowlist HTTPS")
    request = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; VinFastAgent/1.0)",
        "Accept-Language": "vi,en;q=0.8",
    })
    with urllib.request.urlopen(request, timeout=8) as response:
        if not _host_allowed(response.geturl(), domains):
            raise ValueError("Redirect ra ngoài allowlist")
        return response.read(MAX_RESPONSE_BYTES).decode(
            response.headers.get_content_charset() or "utf-8",
            errors="replace",
        )


@tool
@ai_data.pinned
def lookup_official_web(vehicle: str, topic: str) -> str:
    """Look up allowlisted VinFast/dealer pages for details missing from catalog, such as interior materials.

    Do not use this tool for prices, specifications, or exterior colors already in the catalog.

    Args:
        vehicle: Vehicle model, e.g. "VF 6".
        topic: Specific detail to verify, e.g. "nội thất ghế da màu be".
    """
    from src.agents.tools.vinfast_tools import _resolve

    result = {"vehicle": vehicle, "topic": topic, "found": False, "sources": [], "errors": [], "caveats": [
        "Nguồn web có thể là trang đại lý/bên thứ ba, chưa cập nhật hoặc không phân biệt phiên bản.",
        "Nếu khác catalog về giá/thông số, luôn ưu tiên catalog; cần xác nhận với tư vấn viên trước khi cam kết.",
    ]}
    vehicles, unmatched = _resolve([vehicle])
    if not vehicles:
        result["errors"].append(f"Không nhận ra xe '{vehicle}'.")
        return json.dumps(result, ensure_ascii=False)

    try:
        config = _load_source_config()
    except Exception as exc:
        result["errors"].append(f"Không đọc được cấu hình nguồn web trên Supabase: {type(exc).__name__}.")
        return json.dumps(result, ensure_ascii=False)

    domains = config.get("allowed_domains", [])
    source_urls = list(dict.fromkeys(
        url
        for model in {item["model_name"] for item in vehicles}
        for url in config.get("sources", {}).get(model, [])
    ))
    terms = _topic_terms(topic)
    need = max(1, len(terms) // 2)  # cần khớp ít nhất một nửa số từ khoá

    for url in source_urls:
        try:
            parser = _TextParser()
            parser.feed(_fetch_page(url, domains))
            matching = [line for line in parser.lines if _line_hits(line, terms) >= need]
            if matching:
                result["sources"].append({"url": url, "passages": matching[:5]})
        except Exception as exc:
            result["errors"].append(f"{urlparse(url).hostname}: {type(exc).__name__}")

    result["found"] = bool(result["sources"])
    if not result["found"]:
        result["next_step"] = "Chưa tìm thấy nội dung trong nguồn được phép; hướng dẫn liên hệ tư vấn viên/đại lý."
    return json.dumps(result, ensure_ascii=False)
