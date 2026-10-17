# Agent Evaluation v0

This is an internal, draft Vietnamese golden set for the VinFast agent. Do not publish the cases or use them as customer data. The cases are written against the current `VINFAST_TOOLS` contract; they do not assume tools that are not implemented (for example `compare_models`, `compare_trims`, or a dedicated accessory catalog tool).

## Coverage

`agent_cases.v0.jsonl` has 25 cases across structured specs/RAG, cross-model and trim comparison, catalog/configuration pricing, TCO, province fees, promotions, accessories, FAQ/policy, purged catalog records, and out-of-scope handling. Five cases (20%) are adversarial: injection, misspelling/no diacritics, mixed-language input, and unsupported-brand requests. Hard cases are deliberately drawn from prior failure modes. `reviewed_by` remains `pending_domain_review`; exact references, especially time-sensitive promotion data, need a domain-owner review before becoming a release gate.

Some reference contexts describe the source/constraint rather than reproduce a retrieved source passage. Replace these with exact, versioned source excerpts before using RAGAS context metrics or asserting factual-answer accuracy. The rental cutoff is anchored to the checked repository CSV; the VinClub expiry case is pinned to `evaluation_date` and needs confirmation against the current promotion source.

## Case Contract

Each JSONL row carries `id`, `user_input`, `reference`, `reference_contexts`, `expected_tool`, `expected_params`, `category`, `difficulty`, `tags`, `reviewed_by`, and `version`. A null `expected_tool` means the expected behavior is to clarify, refuse, or safely stay within scope without calling a tool. Parameters are exact for listed entity/numeric fields; expected list values may be fulfilled across multiple calls to the same tool. An expected empty accessory list accepts the tool's default `None`; natural-language RAG queries are checked for presence, not exact phrasing. Unspecified arguments are not scored. Assess query relevance separately. When a case expects one tool, that tool must appear in the trace with matching parameters; additional calls do not fail selection by themselves and should be reviewed as trajectory/efficiency.

## Offline Validation And Trace Scoring

```powershell
python scripts/eval/score_agent_cases.py --validate-only
python scripts/eval/score_agent_cases.py --observations path\to\observations.jsonl
```

The observation file is JSONL with `{"id":"case-id","tool_calls":[{"name":"search_vehicles","args":{"vehicle_queries":["VF 6"]}}]}` per row. Scoring reports tool-selection and expected-parameter accuracy overall and by category/difficulty/adversarial tag. This script does not call an LLM, DB, or embedding service. The initial trace must come from an explicit agent run; keep provider credentials and private traces out of this benchmark. Do not use incomplete observations as a release result; compare the reported `unobserved_ids` with the case count and run coverage.

## Evaluation Protocol

1. Run every case at least three times with a pinned model, prompt, tool/data snapshot, and date. Record tool traces, final answer, latency, token/cost estimate, errors, and exact source snapshot/version.
2. Gate deterministic tool choice/parameters and money/policy safety with code. Review answer correctness, faithfulness, relevancy, citation/source validity, format, and refusal/clarification behavior by failure mode, not one overall 1-5 score.
3. Add every confirmed production failure as a regression case. Do not silently rewrite an existing expected answer; version the case and preserve the previous result.
4. Before release gating, replace draft contexts with source passages, review references with a domain expert, and calibrate any LLM judge on at least 50 double-reviewed outputs (target Cohen's kappa >= 0.6, then report TPR/TNR).
5. Report per-item pass rates and confidence intervals. Repeated runs of the same item are not independent samples; compare versions using paired per-item deltas. Set latency/cost and answer-quality thresholds only after a reviewed baseline exists.

RAGAS v0.4 metrics (`ToolCallAccuracy`, `ToolCallF1`, `AgentGoalAccuracy`, faithfulness, answer relevancy, context recall, context precision) can be layered on after trace capture and reference review. Keep trajectory measures (steps/tool calls vs. minimum, recovery) diagnostic rather than allowing efficiency to hide an incorrect answer. A suggested future gate is a lower confidence bound for faithfulness, but the threshold must be calibrated on this private set before CI enforcement.

## Optimization Follow-up Metrics

The runner records raw_tool_calls (LLM arguments before normalization),
tool_calls (arguments executed), and resolved_tool_calls (pricing arguments
confirmed by the tool response). The scorer reports all three parameter rates.
For tools without a response-side resolution contract, resolved arguments are
the executed arguments. Legacy traces have no resolved metric.

business_assertions is optional and versioned per case. The pricing and
injection cases check that the answer includes the exact tool total, that a
pricing hash exists, and that applied discounts have verified status. These
are consistency/safety assertions, not an independent oracle proving the
price is commercially correct. Cases without assertions and legacy traces
without facts remain unmeasured (null); report coverage beside the rate.
References still need domain review.

Run and summarize all timestamped files without typing a placeholder path:

```powershell
.venv\Scripts\python.exe scripts\eval\run_agent_cases.py --runs 3
$agentRun = Get-ChildItem .ai-log\agent-eval -Directory | Sort-Object Name -Descending | Select-Object -First 1
.venv\Scripts\python.exe scripts\eval\report_agent_runs.py --run-dir $agentRun.FullName --output eval\results\latest_agent_metrics.json
```

The report rejects incomplete runs, reports failure modes and mean/P95 latency
by category, and retains per-item means across repeated runs. It does not claim
statistical significance from three repetitions. P95 uses nearest rank; these
small per-category samples are descriptive. timing_mode=non_streaming and
ttft_ms=null explicitly indicate that time to first token was not measured.

## Current Capability Gaps Surfaced

- No dedicated `compare_models`, `compare_trims`, or accessory-catalog tool. The current contract routes comparisons through `search_vehicles`/`lookup_car_color_options` and accessories through sourced RAG or a safe limitation.
- `lookup_province_fees` does not expose road-fee details; road-fee questions need verified RAG context or a new structured fee tool before exact numeric answers can be gated.
- `fee_rules` is a pipeline concept, not a registered agent tool. Do not put it in `expected_tool` until the tool is implemented.
- The expired-promotion case needs a controllable evaluation date and a fixture/source pinned to the stated expiry.
