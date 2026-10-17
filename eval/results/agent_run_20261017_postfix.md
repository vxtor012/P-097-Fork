# Agent Run Report - 2026-10-17 (routing fixes)

## Setup

- Cases: 25 per run, 3 independent conversations per case (75 invocations).
- Configured model: `gpt-4o-mini` with provider selection set to `auto`.
- Traces: `.ai-log/agent-eval/20261017T113642Z/` (local and ignored by Git).
- No migration, database write, or deployment was performed. The agent only made read/tool calls.
- The operational database still does not contain `pricing_policies`; structured calls can therefore fail with `UndefinedTable`.

## Results

| Run | Tool selection | Parameter accuracy | Tool outputs | Failed outputs | Tool success |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 22/25 (88%) | 21/25 (84%) | 28 | 19 | 32.1% |
| 2 | 23/25 (92%) | 23/25 (92%) | 30 | 21 | 30.0% |
| 3 | 23/25 (92%) | 22/25 (88%) | 30 | 21 | 30.0% |
| Mean | **90.7%** | **88.0%** | 29.3 | 20.3 | 30.7% |

The scorer treats `out_of_scope` and `safe_limitation` as successful terminal outcomes for cases whose expected tool is `null`. Runtime errors remain failures.

## Before/after

The earlier run (before deterministic routing fixes) averaged 62.7% tool selection and 62.7% parameter accuracy. The final run averages 90.7% and 88.0%, respectively. Tool-call success rose from 18.6% to 30.7%; the remaining failures are primarily the missing operational table, not routing.

## Fixes verified by traces

- Unsupported brands are rejected before the LLM or VinFast tools; adversarial scope cases passed tool selection in all three runs.
- Accessory questions use `search_gold_knowledge`; accessory-code requests terminate with a safe capability limitation instead of guessing or using color lookup.
- Road-fee questions use the Gold knowledge path and no longer add `lookup_province_fees` after the RAG lookup.
- Rental-policy questions use the Gold policy path and do not offer a new rental option through catalog pricing.
- Expired-promotion checks use `get_eligible_promotions` and carry an explicit `evaluation_date` when the question provides one.
- A pricing request containing “không phụ kiện” is not misclassified as an accessory request.

## Remaining limits

- This is a routing/trace evaluation, not proof of pricing correctness. `pricing_policies` must exist in a reviewed test database before structured pricing, fee, TCO, and promotion execution can be judged.
- The golden references are still marked `pending_domain_review`; no RAGAS or answer-quality judge was run.
- Repeated tool calls and latency/cost efficiency remain diagnostic work. The scorer allows repeated valid calls to satisfy entity coverage, but does not call them efficient.
