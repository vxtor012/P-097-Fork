"""Audit case-oracle drift without calling the agent or changing case files.

Usage: python scripts/eval/audit_agent_cases.py
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CASES = ROOT / "eval" / "agent_cases.v1.jsonl"
ECO_FIELDS = ("user_input", "reference", "reference_contexts", "expected_params", "expected_facts", "must_not_include")
REFERENCE_SOURCES = {
    "vehicle_specs.csv": ROOT / "dataset" / "gold" / "rdb_schema" / "vehicle_specs.csv",
    "gold_vehicles.jsonl": ROOT / "dataset" / "gold" / "gold_vehicles.jsonl",
}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def normalized(value: object, collapse_trim_alias: bool = False) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").replace("đ", "d").replace("Đ", "D"))
    text = "".join(char for char in text if not unicodedata.combining(char)).lower()
    if collapse_trim_alias:
        # Alias-equivalent matching is only for determining whether the source
        # record survives. It does not make an answer automatically correct.
        text = re.sub(r"\b(?:eco|tieu\s*chuan)\b", "base-trim", text)
    return re.sub(r"\s+", " ", text).strip()


def eco_locations(case: dict) -> list[str]:
    return [field for field in ECO_FIELDS if "eco" in json.dumps(case.get(field), ensure_ascii=False).casefold()]


def source_inventory() -> tuple[dict[str, tuple[str, str]], dict[str, str]]:
    text, fingerprints = {}, {}
    for name, path in REFERENCE_SOURCES.items():
        if path.exists():
            raw = path.read_text(encoding="utf-8")
            text[name] = (normalized(raw), normalized(raw, collapse_trim_alias=True))
            fingerprints[name] = sha256(raw.encode("utf-8")).hexdigest()
    return text, fingerprints


def check_reference_context(context: str, sources: dict[str, tuple[str, str]]) -> dict:
    parts = [part.strip() for part in context.split("|")]
    source = parts[0] if parts else ""
    if source not in REFERENCE_SOURCES:
        return {"context": context, "source": source, "status": "unverifiable_source"}
    if source not in sources:
        return {"context": context, "source": source, "status": "source_missing"}
    # Context grammar is deliberately small: source | model | trim | ... = value.
    # A positive result means this evidence still has a corresponding record in
    # the local source snapshot, not that all business semantics were reviewed.
    needles = [normalized(part) for part in parts[1:3] if part]
    if "=" in context:
        needles.append(normalized(context.rsplit("=", 1)[1]))
    strict_present = all(needle and needle in sources[source][0] for needle in needles)
    alias_needles = [normalized(term, collapse_trim_alias=True) for term in needles]
    alias_present = all(needle and needle in sources[source][1] for needle in alias_needles)
    status = (
        "present_in_local_source" if strict_present
        else "renamed_by_trim_alias" if alias_present
        else "missing_or_changed_in_local_source"
    )
    return {
        "context": context,
        "source": source,
        "status": status,
        "match_terms": needles,
    }


def main() -> None:
    rows = [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()]
    sources, fingerprints = source_inventory()
    patterns = {
        "legacy_trim_eco": re.compile(r"\bEco\b", re.I),
        "power_unit": re.compile(r"\b(?:kW|hp|mã lực|mÃ£ lá»±c)\b", re.I),
        "money_value": re.compile(r"\d[\d.,]*\s*(?:tỷ|triệu|đồng|VND)", re.I),
        "time_sensitive": re.compile(r"promotion|ưu đãi|voucher|hiệu lực|hết hạn|VinClub|chuyển đổi xanh", re.I),
    }
    print(json.dumps({
        "case_count": len(rows),
        "oracle_versions": sorted({row.get("version") for row in rows}),
        "flags": {
            name: [row["id"] for row in rows if pattern.search(" ".join(
                [row.get("user_input", ""), row.get("reference", ""),
                 " ".join(row.get("reference_contexts", []))]
            ))]
            for name, pattern in patterns.items()
        },
        "eco_field_locations": {
            row["id"]: eco_locations(row) for row in rows if eco_locations(row)
        },
        "reference_context_check": {
            row["id"]: [check_reference_context(context, sources) for context in row.get("reference_contexts", [])]
            for row in rows if row.get("reference_contexts")
        },
        "local_reference_source_sha256": fingerprints,
        "reference_check_caveat": (
            "Đây là đối chiếu với source snapshot local hiện có. Chỉ dùng làm triage; "
            "v1.1 phải pin các hash này vào manifest run trước khi kết luận oracle_bug."
        ),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
