# Báo cáo đánh giá agent và xác minh sửa lỗi alias trim

| Trường | Giá trị |
|---|---|
| Ngày chạy | 18/10/2026 |
| Mô hình / provider | `gpt-4o-mini` / `auto` |
| Bộ case / oracle | `eval/agent_cases.v1.jsonl` / `v1.0-catalog-20261012` |

## Mục lục

- [1. Tóm tắt điều hành](#1-tóm-tắt-điều-hành)
- [2. Thay đổi đã thực hiện](#2-thay-đổi-đã-thực-hiện)
- [3. Kiểm tra regression cục bộ](#3-kiểm-tra-regression-cục-bộ)
- [4. Full evaluation — 65 case, 1 run](#4-full-evaluation--65-case-1-run)
- [5. Xác minh chuyên sâu: legacy trim alias `pricing-001`](#5-xác-minh-chuyên-sâu-legacy-trim-alias-pricing-001)
- [6. Tái lập run và dependency pinning](#6-tái-lập-run-và-dependency-pinning)
- [7. Giới hạn và hướng xử lý](#7-giới-hạn-và-hướng-xử-lý)
- [8. Kết luận](#8-kết-luận)

---

## 1. Tóm tắt điều hành

Đã chạy lại đầy đủ **65/65 eval case** sau bản vá resolver alias trim. Run hoàn
chỉnh, không thiếu case và được pin với cùng snapshot vận hành, prompt,
alias-contract và code hash trong manifest.

Sửa lỗi trọng tâm đã được xác minh ở cả smoke chuyên sâu và full eval:
`pricing-001` không còn nằm trong danh sách lỗi. Input `VF 6 Eco` được resolve
sang cấu hình catalog `VF6 / Tiêu chuẩn`, công cụ tính giá trả kết quả hợp lệ và
câu trả lời có note đổi tên phiên bản.

Kết quả toàn bộ suite là **37/65 pass code (56,92%)**. Đây là baseline trung
thực sau sửa lỗi, không phải tuyên bố production-ready tổng thể: `facts_ok`
vẫn thấp và 28 case còn fail, trong đó có các nhóm catalog/spec/reference cần
review riêng. Vì vậy fix alias pricing được xem là đã đóng ở tool boundary,
nhưng chất lượng agent tổng thể vẫn còn hạng mục tiếp theo.

## 2. Thay đổi đã thực hiện

- Thêm contract alias versioned: `src/agents/tools/trim_aliases.snapshot.json`.
- Validate contract khi nạp catalog: alias phải trỏ đến đúng một trim hiện hữu;
  catalog drift sẽ fail fast thay vì âm thầm trả dữ liệu sai.
- Sửa resolver để coi `VF6` và `VF 6` là cùng một model khi tách trim. Đây là
  nguyên nhân trực tiếp khiến `VF 6 Eco` trước đây không áp dụng được alias.
- Ghi `requested_version`, `resolved_version` và version contract vào trace.
- Chỉ hiển thị note “Bản Tiêu chuẩn trước đây gọi là Eco.” khi input thực sự
  dùng nhãn legacy; input canonical không có note này.
- Thêm regression test cho hình dạng catalog live `model_name="VF6"` với input
  người dùng `VF 6 Eco`.

## 3. Kiểm tra regression cục bộ

```powershell
.venv\Scripts\python.exe -m pytest `
  tests\test_api `
  tests\test_agents\test_agent_fixes.py `
  tests\test_eval\test_agent_cases.py `
  -q

.venv\Scripts\python.exe scripts\eval\score_agent_cases.py --validate-only
```

| Hạng mục | Kết quả |
|---|---|
| API, agent-fix và eval regression | **81 passed, 9 skipped** |
| Kiểm tra định dạng / bộ case | **65 case; adversarial 29%** |
| `VF6` ↔ `VF 6` + `Eco` → `Tiêu chuẩn` | Pass |
| Fail-fast alias contract và UX note condition | Pass |

Chín test skip phụ thuộc dịch vụ/môi trường không hiện diện trong lần chạy;
chúng không được tính là pass.

## 4. Full evaluation — 65 case, 1 run

### 4.1. Artefact

| Artefact | Đường dẫn |
|---|---|
| Trace | `.ai-log/agent-eval/20261018T012250Z/` |
| Kết quả chấm | `eval/results/agent_metrics_20261018_final.json` |

### 4.2. Metrics tổng hợp

| Metric | Kết quả | 95% CI theo item |
|---|---:|---|
| Case đã quan sát | **65/65** | — |
| `tool_ok` | 90,77% | 83,08%–96,92% |
| `param_ok` | 89,23% | 81,54%–95,38% |
| `forbidden_ok` | 98,46% | 95,38%–100,00% |
| `facts_ok` | 66,15% | 53,85%–76,92% |
| `banned_ok` | 100,00% | 100,00%–100,00% |
| `business_assertions_ok` | 100,00% (3 case có assertion) | 100,00%–100,00% |
| `pass_code` | **56,92% (37/65)** | 44,62%–69,23% |
| Tool execution success | 97,10% | — |
| Mean extra tool calls | 0,20 | — |
| LLM unavailable runs | 0 | — |
| Mean latency | 3.052,1 ms | — |
| P95 latency | 7.020,8 ms | — |

`pass_code` là phép hội các điều kiện scorer trên mỗi item. Nó không thay thế
đánh giá con người về mức hữu ích của câu trả lời. Ngược lại, 100% ở
`business_assertions_ok` chỉ dựa trên ba case có assertion, nên không được
diễn giải thành tỷ lệ đúng nghiệp vụ chung.

### 4.3. Phân bố `pass_code` theo nhóm

| Nhóm | Pass | Nhận xét |
|---|---:|---|
| Fees, quote status, colors, recommendation | 100% | Các nhóm nhỏ; cần đọc cùng cỡ mẫu. |
| Pricing | 83,3% (5/6) | `pricing-001` pass sau alias fix; `pricing-005` còn fail. |
| Compare models | 75,0% (3/4) | Còn một case cần triage. |
| Out of scope | 75,0% (3/4) | Còn một case cần triage. |
| Installment, rolling cost/TCO | 66,7% (2/3) | Còn mismatch từng case. |
| Promotions | 50,0% (3/6) | Cần review date/oracle và response. |
| FAQ policy | 42,9% (3/7) | Cần review facts/reference. |
| Context | 25,0% (1/4) | Cần triage state/reference. |
| Spec lookup | 16,7% (1/6) | Ưu tiên review catalog/reference. |
| Catalog price, compare trims | 0% | Ưu tiên review contract/oracle trước khi dùng làm release gate. |

### 4.4. Danh sách 28 case fail

`accessory-002`, `catalog-001`–`003`, `catalog-008`, `compare-001`,
`compare-003`–`004`, `context-001`–`002`, `context-004`, `faq-001`,
`faq-003`–`004`, `faq-006`, `finance-002`, `pricing-005`, `promo-002`–`004`,
`scope-002`, `security-001`, `spec-001`–`004`, `spec-006`, `tco-003`.

## 5. Xác minh chuyên sâu: legacy trim alias `pricing-001`

Ngoài full eval, một smoke run độc lập đã kiểm tra trực tiếp flow alias:

```text
Tool input:       model="VF 6", version="Eco"
Resolved config:  model="VF6", version="Tiêu chuẩn"
Alias trace:      requested_version="Eco", resolved_version="Tiêu chuẩn"
UX note:          “Bản Tiêu chuẩn trước đây gọi là Eco.”
```

| Kiểm tra smoke | Kết quả |
|---|---:|
| `tool_ok`, `param_ok`, `facts_ok` | 1.0 |
| `business_assertions_ok` | 1.0 |
| `pass_code` | 1.0 |
| Failing items | `[]` |

Smoke artifacts:

- `.ai-log/agent-eval/20261018T012005Z/run-1.jsonl`
- `.ai-log/agent-eval/20261018T012005Z/manifest.json`
- `eval/results/pricing_alias_smoke.json`

## 6. Tái lập run và dependency pinning

Full run manifest (`20261018T012250Z`) đã pin các dependency ảnh hưởng hành vi:

| Dependency | SHA-256 |
|---|---|
| Case set | `14833ac7540274f7b721a158b79950770e6aa1a997830d8190fd43749b6ec4c9` |
| Operational snapshot | `6d857ba192c2d925fd2767f53dac508951b370b0a07cf33dc9f2e8065174524f` |
| Alias contract | `a58c92329233a23c57b87f97f87d0ed694f4e63c4fcabc567243be7549f913c6` |
| Prompt template | `e8fd5071db5b0b7faca88f5754f05db9555304c28d67a8dc96cb8c10dcb32174` |
| Code phục vụ run | `f7aba387e465e204de3df790f30081b13f5621faf0459a64a5b4394c29e4bc1b` |

Manifest có trạng thái `complete`; selected case list và observed case list đều
đủ 65 case. Kết quả do đó không phải là file đang được ghi dở hoặc run lệch
case-list/scorer.

## 7. Giới hạn và hướng xử lý

- Đây là **một** full run; CI được tính theo item, không xem một run là nhiều
  mẫu độc lập. Không dùng để khẳng định tính ổn định giữa nhiều lần gọi model.
- Các case `needs_pinned_snapshot` chỉ kiểm tra tool/tham số/an toàn, không
  xác nhận giá trị nghiệp vụ cụ thể ngoài snapshot đã pin.
- Một số reference/oracle vẫn `pending_domain_review`; cần phân biệt oracle
  stale với lỗi agent trước khi dùng `pass_code` làm cổng release cứng.
- Ưu tiên tiếp theo: triage catalog/spec/reference, `pricing-005`, và paired
  cases `Eco`/`Tiêu chuẩn` khi version case lên v1.1.

## 8. Kết luận

Bản vá alias trim (`VF 6 Eco` → `VF6 / Tiêu chuẩn`) được xác minh **đóng ở tool
boundary**: `pricing-001` pass ở cả full eval và smoke độc lập, regression cục
bộ 81 passed, fail-fast contract hoạt động.

Baseline trung thực của toàn suite sau sửa lỗi là **37/65 (56,92%)**. Con số này
không phải tuyên bố production-ready: `facts_ok` 66,15% và 28 case fail còn lại
tập trung ở các nhóm catalog price, compare trims, spec lookup và FAQ policy —
cần triage contract/oracle/reference riêng (xem §7) trước khi dùng `pass_code`
làm release gate. Thứ tự ưu tiên tiếp theo: review oracle cho catalog price và
compare trims, sau đó đến `pricing-005` và paired cases `Eco`/`Tiêu chuẩn` ở
case version v1.1.
