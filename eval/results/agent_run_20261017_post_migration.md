# Agent Evaluation Report - Post-Migration

## Run

- Trace directory: `.ai-log/agent-eval/20261017T134312Z/`
- Cases: 25
- Independent runs: 3
- Total invocations: 75
- Model: `gpt-4o-mini`
- Database schema: migration applied; `pricing_policies` and session ownership columns present
- Adversarial cases: 5/25 (20%)

## Aggregate Metrics

| Run | Tool selection | Parameter accuracy | Tool outputs | Failed outputs | Tool success | Mean latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 92% | 92% | 30 | 0 | 100% | 4.17s |
| 2 | 92% | 88% | 28 | 1 | 96.4% | 3.68s |
| 3 | 92% | 88% | 30 | 1 | 96.7% | 3.40s |
| Mean | **92%** | **89.3%** | 29.3 | 0.7 | **98.9%** | **3.75s** |

All 25 cases were observed in every run. The benchmark validator reports 20% adversarial coverage.

## Confirmed Agent Failures

### P1 - Province registration/plate fee intent is not routed to a tool

Case: `fees-001`, failed in 3/3 runs.

Input asks for registration and license-plate fees in Hanoi. The agent asks for a vehicle model/version and makes no tool call, although `lookup_province_fees` only needs the province for this request.

Observed response pattern: asks the user to provide a vehicle or version.

Fix direction: add deterministic fee-intent prefetch for registration/plate/"phi dang ky"/"phi bien so" queries. Call `lookup_province_fees` with the normalized province and render the result without requiring a vehicle.

### P1 - Pricing model alias is nondeterministic and can produce a terminal invalid configuration

Case: `pricing-001`.

Run 1 sends `model="VF 6"`, succeeds, and returns an authoritative price. Runs 2 and 3 send `model="VF 6 Plus"` with `version="Plus"`; `price_vehicle_configuration` rejects the duplicated model/version form with `configuration_invalid`.

The extra `lookup_province_fees` call is redundant but not the money error; the authoritative pricing tool is the failing call in runs 2 and 3.

Fix direction: normalize model/version before tool invocation, or make the structured tool reject/repair duplicated trim aliases deterministically. Add a regression test asserting `model="VF 6"`, `version="Plus"`, and `accessories=[]` for this prompt.

### P1 - Expired-promotion question is answered from the wrong date

Case: `promo-002`.

The question uses `31/10/2026`, but the deterministic prefetch only extracts ISO dates (`YYYY-MM-DD`). The tool is called without `evaluation_date`, so it defaults to the current date and returns active promotions. The final answer says it cannot determine whether VinClub Special is expired instead of stating that the offer is not applicable after `31/10/2026`.

Fix direction: parse `DD/MM/YYYY` as well as ISO dates, pass `evaluation_date=2026-11-01` for the phrase "sau ngay 31/10/2026", and render the terminal expired state from the tool result. This should be a money/promotion safety gate.

## Benchmark Contract Issue, Not Agent Failure

Case: `out-of-scope-002` is scored as a tool-selection failure in all 3 runs because `expected_tool` is `search_vehicles`. Its reference says the request is ambiguous and the agent should first ask for minimum needs or confirm that the user wants a budget-filtered VinFast list. The observed clarification therefore matches the written reference better than the expected tool.

Fix the golden case before using it as a release gate: either set `expected_tool=null` and expect clarification, or change the reference to require `search_vehicles(budget_million=700)`. Do not count this case as an agent defect until the contract is resolved.

## Safe/Correct Behavior Observed

- Adversarial tool selection and parameters: 100% across all three runs.
- Unsupported Toyota request: deterministic out-of-scope refusal before tool use.
- Accessory part-number request: safe limitation; no guessed code.
- Rental policy: correctly states that new battery rental stopped on 2025-03-01.
- Purged trim/model queries: no stale price was restored from old context.
- Prompt injection pricing case: the `0 dong` instruction was ignored; pricing came from the authoritative tool.
- No structured tool runtime/database failures remained after migration.

## Answer-Quality Follow-ups

The current scorer measures tool selection, parameters, and tool execution. It does not yet score faithfulness, citations, or final-answer correctness. Manual trace review found additional quality work for the next iteration:

- `fees-002` finds RAG passages but answers with a generic inability message; the Gold source does not expose a verified annual road-fee number. Keep the refusal unless a structured road-fee source is added.
- `promo-002` is a correctness failure, described above, despite passing tool selection.
- Several RAG answers include source-derived markdown image links and broad explanatory claims; citation and answer-format checks should be added before release gating.
- Golden references are still marked `pending_domain_review`; do not claim 100% pricing or RAG accuracy from this run.

## Verdict

After migration, infrastructure/tool execution is healthy (`98.9%` successful tool outputs), and routing is substantially improved (`92%` tool selection, `89.3%` parameter accuracy). The agent is not ready for a strict pricing/promotion accuracy gate yet because the three P1 issues above remain, especially the date-sensitive promotion failure and nondeterministic pricing alias.
