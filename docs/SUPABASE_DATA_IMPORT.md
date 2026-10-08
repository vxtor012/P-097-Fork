# Chuẩn bị và nạp dữ liệu riêng lên Supabase

Guide này dành cho máy quản trị có dữ liệu riêng. [Guide deploy public](CLOUD_DEPLOYMENT.md) chỉ deploy code sau khi DB sẵn sàng. Không commit `.env`, dump DB, CSV, JSONL hay cấu hình nguồn riêng; không copy chúng vào image.

## 1. Chọn đúng project và chuẩn bị công cụ

Cài Python 3.11+ và PostgreSQL client (`pg_dump`, `pg_restore`, `psql`). Clone mã nguồn; mở terminal ở root repository.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Linux/macOS: `source .venv/bin/activate`, dùng `cp .env.example .env` nếu chưa có file. Nếu PowerShell chặn activation, dùng `.\.venv\Scripts\python.exe` thay cho `python`.

Theo [hướng dẫn kết nối PostgreSQL của Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), mở Supabase Dashboard → chọn project → **Connect** → copy URL direct hoặc **Session pooler** port 5432. Direct cần mạng hỗ trợ IPv6 tùy project; session pooler phù hợp máy chỉ có IPv4. URL-encode password. Điền `.env`:

```dotenv
DATABASE_URL=postgresql+asyncpg://<username>:<encoded-password>@<pooler-host>:5432/postgres
MIGRATION_DATABASE_URL=postgresql://<username>:<encoded-password>@<pooler-host>:5432/postgres
MIGRATION_SSLMODE=require
```

Hai URL có thể trỏ cùng DB. `DATABASE_URL` dùng backend; `MIGRATION_DATABASE_URL` dùng migration/import/backup trên máy quản trị. Không dùng Supabase API key thay DB password. Credential owner/admin có quyền migration; browser không nhận credential này.

Project đã kiểm tra trong phiên làm việc: `ddkeoxomfypnoqdcxwxa`. Người triển khai khác phải dùng project của mình; không copy project ref này như một giá trị mặc định.

**Đạt khi:** chọn đúng project/host và cài dependencies/client. Lệnh dưới đây dùng URL PostgreSQL thường, không dùng prefix `+asyncpg` cho pg_dump/psql.

## 2. Backup trước khi thay đổi DB hiện có

Chọn thư mục ngoài repository, có quyền truy cập riêng. Ví dụ PowerShell, đường dẫn backup thay bằng thư mục thực tế:

```powershell
$adminDbUrl = (Get-Content .env | Where-Object { $_ -match '^MIGRATION_DATABASE_URL=' } | Select-Object -First 1) -replace '^MIGRATION_DATABASE_URL=', ''
$env:PGSSLMODE = "require"
pg_dump --dbname="$adminDbUrl" --schema=public --schema=ai_data --schema=supabase_migrations --format=custom --no-owner --no-privileges --file="D:\PrivateBackup\autoquote-before.dump"
if ($LASTEXITCODE -ne 0) { throw "Backup thất bại; dừng thay đổi DB" }
pg_restore --list "D:\PrivateBackup\autoquote-before.dump"
```

Ví dụ đọc `.env` trên yêu cầu giá trị URL nằm một dòng, không bọc dấu nháy. Không in biến URL ra terminal/log. Với Linux/macOS, cung cấp URL bằng môi trường quản trị hoặc password file và chạy các lệnh pg_dump tương đương.

Dump ứng dụng giữ schema/data `public`, `ai_data` nếu đã có, và `supabase_migrations`; không chỉ backup bảng AI. Lưu an toàn vì có thể chứa thông tin người dùng. Đọc danh sách dump chỉ kiểm tra file; để xác nhận khôi phục được, restore thử vào DB riêng trước khi cần phục hồi thật.

**Đạt khi:** pg_dump thoát 0 và có backup đọc được. Không tiếp tục khi backup lỗi.

## 3. Chuẩn bị schema — chọn một trường hợp

### DB mới, chưa có bảng ứng dụng

```bash
python scripts/db/migrate_supabase.py bootstrap
python scripts/db/migrate_supabase.py check
```

Bootstrap tạo schema nghiệp vụ và áp dụng các migration, gồm vector/schema AI. Không dùng `--seed` trong quy trình dữ liệu riêng. Bảng nghiệp vụ mới ban đầu rỗng.

Nếu có **backup dữ liệu nghiệp vụ riêng** từ cùng schema, nạp vào DB mới bằng pg_restore. Dùng dump data-only của các bảng `public` khi chỉ muốn chuyển catalog/nghiệp vụ; không restore schema cũ đè migration mới. Cần đủ bảng tham chiếu (dealer/user trước lead/quote/inventory) và giữ UUID để không đứt liên kết.

Ví dụ xuất dữ liệu public từ DB nguồn bằng `pg_dump --data-only --schema=public --format=custom --no-owner --no-privileges`, rồi:

```powershell
pg_restore --dbname="$adminDbUrl" --data-only --no-owner --no-privileges --exit-on-error --single-transaction "D:\PrivateBackup\public-data.dump"
if ($LASTEXITCODE -ne 0) { throw "Restore data thất bại" }
```

Chỉ dùng trên các bảng đích rỗng. Không chạy restore data-only lên DB đã có dòng cùng UUID; không tắt foreign key để bỏ qua lỗi. Không có backup public thì API nghiệp vụ chưa có catalog; nạp dữ liệu AI ở bước 4 không tự tạo giá trong `public`.

### DB hiện có catalog/nghiệp vụ

```bash
python scripts/db/migrate_supabase.py check
python scripts/db/migrate_supabase.py upgrade
python scripts/db/migrate_supabase.py check
```

Check đầu có thể báo phần schema cần upgrade; xem report rồi upgrade. Upgrade không seed và không thay dữ liệu nghiệp vụ. Nếu runner báo schema drift không hỗ trợ, dừng để viết migration riêng, không xóa bảng hoặc bootstrap lại.

**Đạt khi:** check schema thành công; lịch sử migration có `add_private_ai_data`, ba bảng `ai_data` và extension vector. Có schema chưa đồng nghĩa có active AI dataset.

## 4. Chuẩn bị nguồn AI ngoài repository

Cấu trúc thư mục riêng:

```text
D:/PrivateData/gold/
  rdb_schema/
    battery_rental_fees.csv
    cars_catalog.csv
    fee_rules.csv
    promotions.csv
    provinces.csv
    rolling_cost_matrix.csv
    trims_pricing.csv
    vehicle_colors.csv
  vinfast_embeddings.jsonl
```

Giữ nguyên output pipeline. CSV phải có header đúng định dạng nguồn, giá trị và tham chiếu hợp lệ. JSONL cần ID duy nhất (`chunk_id` hoặc `vehicle_id`), nội dung text, model `text-embedding-3-small` và vector 1536 chiều hữu hạn/khác zero. [Supabase yêu cầu dùng cùng model cho embedding nguồn và câu hỏi](https://supabase.com/docs/guides/ai/semantic-search). Tool không tự tạo embedding hoặc sửa record lỗi. Catalog và ma trận phí phải có cấu hình pin tương ứng để tính TCO; thiếu dòng phù hợp thì backend báo thiếu dữ liệu, không lấy phí thuê pin thay cho mua pin. Nguồn hiện đã nạp ghi catalog kèm pin nhưng ma trận phí chỉ ghi thuê pin; nội dung pipeline này được giữ nguyên. Muốn có TCO đầy đủ cần xuất lại nguồn đúng từ pipeline rồi import phiên bản mới.

Có thể thêm file web riêng: JSON object `allowed_domains` là danh sách domain, `sources` ánh xạ tên model sang danh sách URL HTTPS thuộc các domain đó. Dùng `--web-sources-file <path>` khi plan/apply/check. Nếu không có file, catalog/RAG vẫn chạy; web lookup báo không khả dụng.

**Đạt khi:** có đủ tám CSV và JSONL trên máy quản trị; không có file nào được stage vào Git.

## 5. Plan trước khi nạp

```powershell
python scripts/db/import_ai_data.py plan --source-dir "D:\PrivateData\gold"
```

Nếu có web config:

```powershell
python scripts/db/import_ai_data.py plan --source-dir "D:\PrivateData\gold" --web-sources-file "D:\PrivateData\web_sources.json"
```

Plan không kết nối hoặc ghi DB; in model, SHA-256 manifest và số dòng. Lỗi chỉ ra nguồn cần sửa. Không bỏ qua lỗi/record rồi nạp một phần.

**Đạt khi:** plan thoát 0, số dòng đúng nguồn. Snapshot hiện đã kiểm tra có 178 knowledge record; các nguồn khác có thể có số dòng khác.

## 6. Nạp và kích hoạt

```powershell
python scripts/db/import_ai_data.py apply --source-dir "D:\PrivateData\gold" --name "Catalog-2026-10"
python scripts/db/import_ai_data.py check --source-dir "D:\PrivateData\gold"
python scripts/db/import_ai_data.py check
```

Nếu plan có `--web-sources-file`, truyền cùng file cho apply và check đối chiếu nguồn. Không thay file giữa plan và apply; apply vẫn kiểm tra lại toàn bộ.

Apply tạo phiên bản mới và kích hoạt sau khi đối chiếu thành công trong cùng transaction. Giữ record gốc, chuỗi CSV và các bảng `public`; không ghi đè giá/promo/mock. Lỗi rollback toàn bộ. Nạp cùng manifest là no-op: `unchanged: true`, không tăng số dòng. Nếu phiên bản đó đã inactive, no-op không tự kích hoạt lại; dùng bước 7.

Ghi lại `dataset_id`, `sha256`, `row_counts`, `active: true`. Không ghi credential vào nhật ký. Check có nguồn so sánh từng nội dung; check không nguồn kiểm tra counts, digest, metadata và vector trong DB.

Backend chọn active dataset cho mỗi lượt agent; lượt đang chạy giữ phiên bản cũ. Không cần rebuild hoặc copy file lên Render.

**Đạt khi:** cả hai check thoát 0, active đúng ID; test catalog/chat/RAG theo bước 5 của guide deploy. `public` và `ai_data` có thể khác snapshot thời gian: cập nhật nguồn có chủ đích, không tự sửa giá để khớp.

## 7. Rollback dữ liệu AI

Liệt kê phiên bản bằng Supabase SQL Editor:

```sql
SELECT id, name, created_at, is_active, content_sha256, row_counts
FROM ai_data.datasets ORDER BY created_at DESC;
```

Kích hoạt ID cũ đã kiểm chứng:

```bash
python scripts/db/import_ai_data.py activate --dataset-id UUID_CU
python scripts/db/import_ai_data.py check
```

Activate kiểm tra đủ dữ liệu trước khi chuyển trong transaction. Phiên bản mới vẫn được giữ để điều tra; không tự xóa dữ liệu. Đây là rollback snapshot AI, không rollback migration/schema hoặc dữ liệu nghiệp vụ.

## 8. Phục hồi backup và vận hành

Khi cần khôi phục dữ liệu ứng dụng, ưu tiên restore thử vào project/DB riêng, kiểm tra schema/catalog/AI, rồi chuyển URL backend sau khi xác nhận. Không restore đè project đang hoạt động hoặc chạy `--clean` nếu chưa có kế hoạch downtime và backup hiện tại.

DB đích riêng cần extension vector phù hợp trước khi restore. `pg_restore --no-owner --no-privileges --exit-on-error --single-transaction` giúp dừng khi lỗi; sau restore chạy migration check, importer check và kiểm tra quyền schema/table. Dump bỏ owner/grants nên cần tái áp dụng cấu hình quyền theo migration; không mở quyền anon để giải quyết lỗi backend.

RLS bật nhưng không có policy là chủ đích vì chỉ backend/owner đọc bảng, browser không có grant. Advisor INFO “RLS Enabled No Policy” phù hợp cấu hình này; không mở policy public để làm thông báo biến mất. Xem [giải thích advisor của Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Migration đã áp dụng không được sửa lại file. Tạo migration mới bằng Supabase CLI; runner chia sẻ lịch sử với `supabase_migrations.schema_migrations`. Lưu bản mã nguồn tương ứng cùng backup để đối chiếu phiên bản.

Mock nghiệp vụ, nếu cần, dùng `scripts/db/mock_data.py --help` rồi `plan/check` trước; `apply` chỉ khi chủ đích thay dữ liệu demo. Import AI không tự tạo hay sửa mock. Không dùng mock command trên giao dịch thật.

| Lỗi | Cách xử lý |
| --- | --- |
| Header/tham chiếu/vector lỗi | Sửa quy trình xuất/pipeline ở nguồn riêng, chạy lại plan; không tự bỏ dòng |
| Extension vector không có | Dùng Supabase hoặc PostgreSQL có pgvector; local Compose dùng image pgvector |
| Permission denied | Kiểm tra role admin/backend và đúng project; không cấp quyền browser |
| No active AI dataset | Chạy apply hoặc activate phiên bản đã tồn tại |
| Manifest/source mismatch | Dùng đúng bộ nguồn/web config đã nạp; kiểm tra checksum |
| Public data changed concurrently | Import đã rollback; chạy lại lúc ít ghi nghiệp vụ |
| Import timeout/lock timeout | Kiểm tra pooler, tải DB và tiến trình migration khác; không chạy nhiều apply song song |
| Catalog UI rỗng nhưng AI chạy | Public catalog chưa được nạp; AI snapshot không thay thế bảng nghiệp vụ |
