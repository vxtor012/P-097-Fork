"""Chạy agent thật trên bộ case v1 và ghi trace JSONL (CẦN: OPENAI_API_KEY, DATABASE_URL, mạng ra OpenAI).

    python scripts/eval/run_agent_cases.py --runs 3
    python scripts/eval/run_agent_cases.py --runs 1 --ids spec-001,promo-004      # chạy thử vài case
    python scripts/eval/run_agent_cases.py --runs 3 --freeze-date 2026-10-18     # ghim ngày (cần freezegun)

Mỗi run ghi `.ai-log/agent-eval/<timestamp>/run-N.jsonl`, mỗi dòng một case:
  {id, run, answer, error, latency_ms, tool_calls[{name,args}], tool_outputs[{name,content,failed}], meta}

Không đặt khóa/trace riêng tư vào Git (thư mục .ai-log đã bị ignore).
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import sys
import time
import uuid
from contextlib import nullcontext
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage  # noqa: E402

from src.agents import graph as agent_graph  # noqa: E402
from src.agents.graph import AGENT_SYSTEM, agent  # noqa: E402
from src.agents.tools import vinfast_tools  # noqa: E402
from src.agents.tools.vinfast_tools import TRIM_ALIASES_PATH  # noqa: E402
from src.config import get_settings  # noqa: E402
from src.db import AsyncSessionLocal  # noqa: E402
from src.operational_data import dataset_scope  # noqa: E402
from src.services.pricing import load_pricing_tables  # noqa: E402

CASES = ROOT / "eval" / "agent_cases.v1.jsonl"
ORACLE_VERSION = "v1.0-catalog-20261012"
# Phiên đã xác thực giả lập cho case quote-*: chỉ để kiểm tra luồng, không phải dữ liệu thật.
QUOTE_FIXTURE = [{"id": "eval-quote-1", "status": "pending", "reviewed_at": None}]


def load_cases(ids: set[str] | None) -> list[dict]:
    rows = [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()]
    return [r for r in rows if not ids or r["id"] in ids]


def case_set_sha256(cases: list[dict]) -> str:
    """Stable identity for the exact case definitions used by a run."""
    payload = json.dumps(cases, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def atomic_json(path: Path, value: dict) -> None:
    partial = path.with_suffix(path.suffix + ".partial")
    partial.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(partial, path)


def execution_fingerprint(tables: dict) -> dict:
    settings = get_settings()
    model = settings.google_model_name if settings.llm_provider == "google" else settings.model_name
    snapshot = json.dumps(tables, default=str, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    alias_contract = TRIM_ALIASES_PATH.read_bytes()
    code_parts = []
    for path in (Path(__file__), Path(agent_graph.__file__), Path(vinfast_tools.__file__)):
        code_parts.append(path.name.encode("utf-8") + b"\0" + path.read_bytes())
    return {
        "provider": settings.llm_provider,
        "model": model,
        "prompt_template_sha256": hashlib.sha256(AGENT_SYSTEM.encode("utf-8")).hexdigest(),
        "operational_snapshot_sha256": hashlib.sha256(snapshot.encode("utf-8")).hexdigest(),
        "trim_alias_contract_sha256": hashlib.sha256(alias_contract).hexdigest(),
        "code_sha256": hashlib.sha256(b"\0".join(code_parts)).hexdigest(),
    }


async def load_tables() -> dict:
    async with AsyncSessionLocal() as db:
        tables = await load_pricing_tables(db)
    tables["customer_claims"] = {}
    tables["quote_statuses"] = QUOTE_FIXTURE
    return tables


def build_state(case: dict) -> dict:
    messages = []
    for turn in case.get("conversation", []):
        cls = HumanMessage if turn["role"] == "user" else AIMessage
        messages.append(cls(content=turn["content"]))
    messages.append(HumanMessage(content=case["user_input"]))
    return {
        "question": case["user_input"],
        "messages": messages,
        "profile": {},
        "vehicle_context": case.get("vehicle_context", {}),
    }


def extract_trace(result: dict, prior: int) -> tuple[list[dict], list[dict]]:
    """Chỉ lấy tool call/output của lượt hiện tại (sau tin nhắn người dùng cuối)."""
    messages = result.get("messages", [])
    last_human = max((i for i, m in enumerate(messages) if isinstance(m, HumanMessage)), default=prior)
    calls, outputs = [], []
    by_id: dict[str, str] = {}
    for m in messages[last_human + 1:]:
        if isinstance(m, AIMessage):
            for c in m.tool_calls or []:
                calls.append({"name": c["name"], "args": c.get("args", {}),
                              "raw_args": (m.response_metadata.get("raw_tool_calls") or [{}])[0].get("args")
                              if m.response_metadata.get("raw_tool_calls") else None})
                by_id[c["id"]] = c["name"]
        elif isinstance(m, ToolMessage):
            content = m.content if isinstance(m.content, str) else json.dumps(m.content, ensure_ascii=False)
            outputs.append({"name": by_id.get(m.tool_call_id, getattr(m, "name", "")), "content": content[:4000],
                            "failed": _failed(content)})
    return calls, outputs


def pricing_facts(answer: str, outputs: list[dict]) -> dict:
    """Capture deterministic evidence required by pricing benchmark assertions."""
    for output in outputs:
        if output["name"] != "price_vehicle_configuration":
            continue
        try:
            payload = json.loads(output["content"])
        except (TypeError, ValueError):
            continue
        if not isinstance(payload, dict) or "final_price" not in payload:
            continue
        total = f"{int(payload['final_price']):,}".replace(",", ".")
        decisions = payload.get("promotion_decisions", [])
        return {
            "pricing_total_matches_tool": total in answer.replace(",", "."),
            "pricing_hash_present": bool(payload.get("pricing_hash")),
            "discounts_verified": all(
                decision.get("state") == "verified_applied"
                for decision in decisions
                if decision.get("applied_to_price")
            ),
        }
    return {}


def _failed(content: str) -> bool:
    """Lỗi hạ tầng/thực thi (retryable hoặc exception). Lỗi nghiệp vụ retryable=false không tính là hỏng tool."""
    if content.startswith("Error") or "UndefinedTable" in content:
        return True
    try:
        data = json.loads(content)
    except ValueError:
        return False
    err = data.get("error") if isinstance(data, dict) else None
    if not err:
        return False
    return bool(err.get("retryable")) if isinstance(err, dict) else bool(data.get("retryable", False))


def run_case(case: dict, tables: dict, run: int, execution_meta: dict) -> dict:
    state = build_state(case)
    started = time.perf_counter()
    try:
        with dataset_scope(tables):
            result = agent.invoke(state, {"configurable": {"thread_id": str(uuid.uuid4())}})
        err = result.get("error")
    except Exception as exc:  # noqa: BLE001 - ghi lại để báo cáo, không làm hỏng cả lượt chạy
        result, err = {"messages": []}, f"exception:{type(exc).__name__}:{exc}"
    latency = (time.perf_counter() - started) * 1000
    calls, outputs = extract_trace(result, len(state["messages"]) - 1)
    answer = result.get("answer", "")
    return {
        "id": case["id"], "run": run, "answer": answer, "error": err,
        "latency_ms": round(latency, 1), "tool_calls": calls, "tool_outputs": outputs,
        "facts": pricing_facts(answer, outputs),
        "meta": {
            **execution_meta, "timing_mode": "non_streaming", "ttft_ms": None,
            "oracle_version": ORACLE_VERSION,
            "case_version": case.get("version"),
            "evaluation_date": case.get("evaluation_date"),
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--ids", help="danh sách id, phân tách bằng dấu phẩy")
    ap.add_argument("--freeze-date", help="YYYY-MM-DD: ghim ngày hệ thống (cần freezegun)")
    args = ap.parse_args()

    cases = load_cases(set(args.ids.split(",")) if args.ids else None)
    if not cases:
        ap.error("Không tìm thấy case nào khớp --ids")
    tables = asyncio.run(load_tables())
    execution_meta = execution_fingerprint(tables)
    out_dir = ROOT / ".ai-log" / "agent-eval" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.freeze_date:
        from freezegun import freeze_time  # type: ignore
        clock = freeze_time(args.freeze_date, tick=True)
    else:
        clock = nullcontext()

    with clock:
        for run in range(1, args.runs + 1):
            path = out_dir / f"run-{run}.jsonl"
            partial_path = path.with_suffix(path.suffix + ".partial")
            with partial_path.open("w", encoding="utf-8") as fh:
                for i, case in enumerate(cases, 1):
                    row = run_case(case, tables, run, execution_meta)
                    fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                    fh.flush()
                    print(f"run {run} [{i}/{len(cases)}] {case['id']} {row['latency_ms']:.0f}ms err={row['error']}")
            os.replace(partial_path, path)
    atomic_json(out_dir / "manifest.json", {
        "format_version": 1,
        "status": "complete",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "case_file": str(CASES.relative_to(ROOT)).replace("\\", "/"),
        "case_set_sha256": case_set_sha256(load_cases(None)),
        "selected_case_ids": [case["id"] for case in cases],
        "selected_case_set_sha256": case_set_sha256(cases),
        "runs": args.runs,
        "oracle_version": ORACLE_VERSION,
        "freeze_date": args.freeze_date,
        **execution_meta,
    })
    print(f"\nTrace: {out_dir}")
    print(f"Chấm: python scripts/eval/score_agent_cases.py --run-dir {out_dir}")


if __name__ == "__main__":
    main()
