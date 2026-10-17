"""Run the private golden cases against the configured live agent and save local traces."""

import argparse
import asyncio
import json
import re
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

from langchain_core.messages import AIMessage, ToolMessage

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.agents.graph import agent  # noqa: E402, I001
from src.config import get_settings  # noqa: E402, I001


CASES = ROOT / "eval" / "agent_cases.v0.jsonl"
OUTPUT_ROOT = ROOT / ".ai-log" / "agent-eval"


def read_cases():
    with CASES.open(encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def message_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(block.get("text", "") for block in content if isinstance(block, dict))
    return str(content or "")


async def run_case(case, run_number):
    started = time.perf_counter()
    error = None
    try:
        result = await agent.ainvoke(
            {"query": case["user_input"]},
            {"configurable": {"thread_id": f"eval-{run_number}-{uuid.uuid4()}"}},
        )
    except Exception as exc:
        result = {}
        error = type(exc).__name__

    calls = []
    raw_calls = []
    resolved_calls = []
    tool_outputs = []
    facts = {}
    for message in result.get("messages", []):
        if isinstance(message, AIMessage):
            calls.extend({"id": call.get("id"), "name": call.get("name"), "args": call.get("args", {})}
                         for call in (message.tool_calls or []))
            raw_calls.extend({"id": call.get("id"), "name": call.get("name"), "args": call.get("args", {})}
                             for call in message.response_metadata.get("raw_tool_calls", message.tool_calls or []))
        elif isinstance(message, ToolMessage):
            content = message_text(message.content)
            tool_outputs.append({"name": message.name, "tool_call_id": message.tool_call_id,
                                 "status": message.status, "content": content})
    outputs_by_call = {item["tool_call_id"]: item for item in tool_outputs}
    for call in calls:
        resolved = dict(call)
        output = outputs_by_call.get(call["id"], {})
        try:
            payload = json.loads(output.get("content", "{}"))
        except (ValueError, TypeError):
            payload = {}
        if call["name"] == "price_vehicle_configuration" and isinstance(payload, dict):
            configuration = payload.get("configuration")
            if isinstance(configuration, dict):
                resolved["args"] = {**call["args"], **configuration}
                model = resolved["args"].get("model", "")
                if isinstance(model, str) and (match := re.fullmatch(r"VF\s*(\d+)", model, re.I)):
                    resolved["args"]["model"] = f"VF {match.group(1)}"
                resolved["resolution_confirmed"] = True
            if "final_price" in payload:
                formatted_total = f"{payload['final_price']:,}".replace(",", ".") + " đồng"
                facts["pricing_total_matches_tool"] = formatted_total in result.get("response", result.get("answer", ""))
                facts["pricing_hash_present"] = bool(payload.get("pricing_hash"))
                facts["discounts_verified"] = all(
                    decision.get("state") == "verified_applied"
                    for decision in payload.get("promotion_decisions", []) if decision.get("applied_to_price")
                )
        resolved_calls.append(resolved)
    return {
        "id": case["id"],
        "tool_calls": calls,
        "raw_tool_calls": raw_calls,
        "resolved_tool_calls": resolved_calls,
        "answer": result.get("response", result.get("answer", "")),
        "tool_outputs": tool_outputs,
        "facts": facts,
        "error": error or result.get("error"),
        "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        "ttft_ms": None,
        "timing_mode": "non_streaming",
    }


async def run_all(cases, runs, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    for run_number in range(1, runs + 1):
        trace_path = output_dir / f"run-{run_number}.jsonl"
        with trace_path.open("w", encoding="utf-8") as trace_file:
            for index, case in enumerate(cases, 1):
                record = await run_case(case, run_number)
                trace_file.write(json.dumps(record, ensure_ascii=False) + "\n")
                trace_file.flush()
                print(f"run {run_number}/{runs}: case {index}/{len(cases)} {case['id']} "
                      f"{record['latency_ms']:.0f}ms error={record['error'] or '-'}", flush=True)
                await asyncio.sleep(0.25)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=3)
    args = parser.parse_args()
    if args.runs < 1 or args.runs > 5:
        parser.error("--runs must be between 1 and 5")

    settings = get_settings()
    has_llm_key = bool(settings.openai_api_key.strip() or settings.google_api_key.strip())
    if not has_llm_key:
        parser.error("No configured LLM API key; configure one without printing or sharing its value")

    cases = read_cases()
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    output_dir = OUTPUT_ROOT / stamp
    print(f"provider={settings.llm_provider}; model={settings.model_name if settings.llm_provider != 'google' else settings.google_model_name}; "
          f"cases={len(cases)}; runs={args.runs}; output={output_dir.relative_to(ROOT)}", flush=True)
    asyncio.run(run_all(cases, args.runs, output_dir))


if __name__ == "__main__":
    main()
