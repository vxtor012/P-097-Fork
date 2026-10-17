# Agent Optimization Review

## Scope

This iteration targets the three confirmed benchmark failures from
`.ai-log/agent-eval/20261017T134312Z/` and reduces avoidable LLM turns on
high-risk structured intents.

The previous valid benchmark baseline was 25 cases x 3 runs with mean latency
of 3.75 s. The live rerun could not complete in this environment because the
OpenAI connection was blocked with Windows `WinError 10013`; the partial trace
was not used for scoring.

## Changes

- Registration/plate fee questions with a detectable province now prefetch
  `lookup_province_fees` deterministically. The authoritative fee result is
  rendered directly, so the agent does not ask for an unnecessary vehicle
  model or spend a second LLM turn.
- `price_vehicle_configuration` now repairs the duplicated trim alias shape
  (`model="VF 6 Plus", version="Plus"`) by resolving the model alias and
  validating its edition before pricing.
- Promotion date extraction accepts both ISO and Vietnamese `DD/MM/YYYY`.
  Wording such as “sau ngày 31/10/2026” is evaluated as `2026-11-01`.
- `out-of-scope-002` now expects clarification with no tool call, matching its
  reference answer. `promo-002` explicitly gates `evaluation_date`.
- Evaluation runner imports were cleaned so the runner passes ruff checks.

## Local Verification

- `69 passed` from `tests/test_agents`, `tests/test_eval`, and
  `tests/test_db/test_migrations.py`.
- Ruff passes for the changed agent, evaluation, and test modules.
- `git diff --check` passes.

## Remaining Validation

Run the live benchmark from a terminal with outbound LLM access:

```powershell
.venv\Scripts\python.exe scripts\eval\run_agent_cases.py --runs 3
```

Then score the actual timestamped files printed by the runner. Do not score
the aborted `20261017T140319Z` trace; it contains only `llm_unavailable` cases.

The next report should compare mean latency and the three fixed cases against
the 3.75 s baseline. The fee and pricing fixes are covered by deterministic
unit tests, while the final promotion wording still needs one live trace
because it depends on the operational promotion snapshot.

## Follow-up optimization changes

- Added a deterministic clarification gate for budget-only vehicle questions
  that do not contain a model or minimum selection criteria. The gate reuses
  the existing terminal clarification contract and prevents an unbounded
  search_vehicles catalog dump.
- Added deterministic batching for comparison questions. Cross-model
  comparisons use one search_vehicles call; same-model color comparisons use
  one lookup_car_color_options call.
- Added compact agent projections. Catalog image URLs are omitted by default
  and can be requested explicitly with include_images=true.
- Canonicalized price_vehicle_configuration model spelling without an extra
  catalog/DB lookup. Raw LLM calls are retained separately from executed calls.
- Added resumable recommendation slots (including unknown/skip), and bounded
  budget-only catalog results to three distinct model candidates.
- Extended the scorer so clarification_required is a valid terminal outcome
  for cases whose reference expects a clarification without a tool call.

The scorer now reports raw/executed/resolved parameter rates, explicit
per-case business consistency assertions, failure modes and latency by
category. TTFT remains null because the runner uses non-streaming invocation.

## Interim Live Result

One complete 25-case run succeeded with network permission at
`.ai-log/agent-eval/20261017T144502Z/run-1.jsonl`. This predates the final model
spelling fix, raw/resolved instrumentation and recommendation resume changes;
do not label it as validation of the final working tree.

| Metric | Previous 3-run aggregate | Interim single run |
| --- | ---: | ---: |
| Tool selection | 97.3% | 100% (25/25) |
| Executed parameter accuracy | 93.3% | 92% (23/25) |
| Tool execution success | 100% | 100% (25 outputs) |
| Mean total latency | about 4.00 s | 3.461 s |
| P95 total latency | about 11.75 s | 7.413 s (nearest rank) |

The observed mean is about 13.5% lower, but one run versus three runs is not
enough to establish a stable improvement. No statistical significance is claimed.
Both parameter failures were `model=VF6` versus the reference `VF 6`; their
outputs were successful. The final code fixes this spelling while retaining
the raw arguments for diagnosis. No updated live parameter rate is claimed.

- out-of-scope-002: 5.1 ms, clarification, no LLM or tool call.
- compare-models-001: 4.518 s, one compact search_vehicles call.
- compare-trims-002: 3.228 s, one batched color lookup.
- spec-001: 14.929 s, two different RAG queries (range and charging). These
  are separate information needs rather than duplicate queries.
- spec-002: 7.413 s, an unnecessary technical catalog lookup followed by RAG.
- pricing-001 and injection pricing each also called lookup_province_fees;
  this is redundant because the authoritative pricing response includes fees.

Machine-readable interim metrics and failure IDs are in
`eval/results/agent_metrics_20261017_followup_interim.json`.

## Final Validation Status

Offline validation: 135 passed, 12 skipped; Ruff and git diff --check pass.
The sandbox attempt `20261017T143955Z` stopped after three connection failures
and must never be scored. Two requests to start the final three-run benchmark
timed out in automatic permission review before process creation. Consequently
the final code still needs a complete three-run live validation. No migration
or deployment was performed during this optimization.

```powershell
.venv\Scripts\python.exe scripts\eval\run_agent_cases.py --runs 3
$agentRun = Get-ChildItem .ai-log\agent-eval -Directory | Sort-Object Name -Descending | Select-Object -First 1
.venv\Scripts\python.exe scripts\eval\report_agent_runs.py --run-dir $agentRun.FullName --output eval\results\latest_agent_metrics.json
```

## Final Three-Run Result

The completed final run is `.ai-log/agent-eval/20261017T150251Z/` and contains
25 cases in each of `run-1.jsonl`, `run-2.jsonl`, and `run-3.jsonl`.

| Metric | Run 1 | Run 2 | Run 3 | Mean across runs |
| --- | ---: | ---: | ---: | ---: |
| Tool selection | 100% | 100% | 100% | 100% |
| Raw parameter accuracy | 100% | 100% | 100% | 100% |
| Resolved parameter accuracy | 100% | 100% | 100% | 100% |
| Tool execution success | 100% | 100% | 100% | 100% |
| Mean latency | 3.091 s | 2.575 s | 2.711 s | 2.792 s |
| P95 latency | 7.177 s | 4.755 s | 5.121 s | 5.684 s |

There were no failed cases or unobserved cases. The two explicit pricing
business assertions passed in every run: rendered total matched the tool,
pricing hash was present, and every applied discount had verified status.
Business outcome coverage is 2/25 because the remaining cases do not yet have
reviewed field-level assertions.

Against the previous 3-run baseline (mean about 3.75 s, P95 about 11.75 s),
the final mean is about 25.5% lower and the average of the three nearest-rank
P95 values is about 51.6% lower. The comparison is descriptive because model,
network and data conditions can vary; no significance claim is made.

The slowest items across runs are `spec-001` (6.932 s mean), `spec-002`
(5.489 s), `tco-002` (4.770 s), `compare-models-001` (4.604 s), and `tco-001`
(4.495 s). These are the remaining optimization targets. `out-of-scope-002`
averages 6.2 ms and remains deterministic.

Final machine-readable output:
`eval/results/agent_metrics_20261017_final.json`.
