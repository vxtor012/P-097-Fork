# Supabase: tạo database, nâng cấp và phục hồi

Dành cho người triển khai/tiếp quản dự án bằng tài khoản của mình. Lệnh chạy từ thư mục gốc repository, với Python 3.11+ và dependencies trong `requirements.txt`. Không cần project ref, password hay tài khoản của tác giả.

## 1. Chọn quy trình

| Tình trạng | Lệnh / mục |
| --- | --- |
| Project mới, database chưa có bảng ứng dụng | `bootstrap`, mục 4 |
| Database cũ có dữ liệu | Backup → `check` → `upgrade` → `check`, mục 5 |
| Đổi giá/phí/ưu đãi | Migration dữ liệu được duyệt riêng, mục 7 |
| Phục hồi | Mục 8 |

Nguồn schema: `src/orm_models.py`, baseline `scripts/db/schema.sql`, nâng cấp `supabase/migrations/`. `seed.sql` chỉ là snapshot demo. `create_all()` khi backend startup không ALTER bảng cũ và không chạy seed.

Migration `20261008030728_harden_autoquote_database.sql` đã được áp dụng trên P097 ngày 08/10/2026. File local có cùng version/name với lịch sử Supabase. Không sửa migration đã áp dụng; thay đổi tiếp theo tạo bằng `supabase migration new <name>`.

## 2. Tạo project và chọn kết nối

1. Supabase Dashboard → tạo project trong organization của bạn; chọn region gần backend.
2. Đặt password mạnh, lưu trong kho bí mật, đợi project sẵn sàng.
3. **Connect** → sao chép connection string, host/port/user/database.
4. Backend Render chạy lâu dài: direct connection khi mạng hỗ trợ, hoặc Session pooler cổng 5432 cho IPv4. Dùng direct/session cho migration và backup.
5. Transaction pooler cổng 6543 có giới hạn prepared statements; backend/script hiện tắt cache. Không dùng chế độ này làm lựa chọn mặc định cho DDL/backup.

Host/username phải lấy từ Dashboard, không tự ghép từ region. [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 3. Cấu hình và kiểm tra mục tiêu

```bash
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cp .env.example .env
# PowerShell: Copy-Item .env.example .env
```

Đặt trong `.env` (thay placeholder):

```dotenv
DATABASE_URL=postgresql+asyncpg://postgres.<project-ref>:<encoded-password>@<pooler-host>:5432/postgres
MIGRATION_DATABASE_URL=postgresql://postgres.<project-ref>:<encoded-password>@<pooler-host>:5432/postgres
MIGRATION_SSLMODE=require
```

`DATABASE_URL` dùng cho backend. `MIGRATION_DATABASE_URL` là kết nối quản trị cho script, bỏ trống để dùng `DATABASE_URL`. Password có ký tự đặc biệt phải URL-encode. Không đưa các biến này vào frontend hay Git. Script tự dùng SSL require cho hostname Supabase; host custom dùng `MIGRATION_SSLMODE` hoặc cấu hình URL phù hợp.

```bash
python scripts/db/migrate_supabase.py --help
python scripts/db/migrate_supabase.py check
```

Script in host/database không kèm password/query string, rồi báo cột thiếu, kiểu hai cột ảnh/màu nóc, số dòng, RLS, public grants, khóa ngoại thiếu index và hai unique index bắt buộc. `check` chỉ đọc: exit 0 khi các kiểm tra đạt, exit 1 khi cần nâng cấp hoặc cấu hình sai. Đối chiếu host/project trước lệnh ghi. Script chỉ hỗ trợ nâng cấp drift đã biết; nếu thiếu bảng/cột khác, sẽ dừng để lập migration riêng.

### Backup trước nâng cấp

Cài PostgreSQL client `psql`, `pg_dump`, `pg_restore`; pg_dump cùng hoặc mới hơn major version server. Kiểm tra `pg_dump --version`. Cấu hình CLI bằng PG env; không dùng prefix `postgresql+asyncpg://` cho psql.

Bash:

```bash
export PGHOST='<host-from-Connect>'
export PGPORT='5432'
export PGDATABASE='postgres'
export PGUSER='<user-from-Connect>'
export PGSSLMODE='require'
```

PowerShell:

```powershell
$env:PGHOST = '<host-from-Connect>'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = '<user-from-Connect>'
$env:PGSSLMODE = 'require'
```

```bash
psql -W -X -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user, version();"
pg_dump -W --format=custom --schema=public --no-owner --no-acl --file=app-before-upgrade.dump
pg_restore --list app-before-upgrade.dump
pg_dump -W --schema-only --schema=public --no-owner --no-acl --file=app-before-upgrade-schema.sql
```

`-W` hỏi password. Lưu backup ngoài Git, có kiểm soát truy cập. Đây là backup `public`, không chứa Supabase Auth, global roles, file Storage hay lịch sử trong schema `supabase_migrations`. Lưu thêm danh sách migration đã áp dụng trong hồ sơ release và kiểm tra quyền/RLS sau restore. [Supabase backups](https://supabase.com/docs/guides/platform/backups).

## 4. Bootstrap database trống

```bash
# Chỉ tạo bảng/index/RLS, không nạp dữ liệu demo:
python scripts/db/migrate_supabase.py bootstrap
# HOẶC tạo schema và nạp snapshot demo ngay trong lần bootstrap:
python scripts/db/migrate_supabase.py bootstrap --seed
python scripts/db/migrate_supabase.py check
```

Chọn một trong hai lệnh bootstrap, không chạy liên tiếp. Script từ chối nếu có bất kỳ bảng ứng dụng nào, kể cả bảng rỗng. Schema, seed tùy chọn và migration history cùng nằm trong transaction; lỗi SQL rollback toàn bộ, không bị bỏ qua. File schema đã có `image_url`, `roof_hex`, index và RLS; seed đã sửa lỗi dấu phẩy nên không cần file bootstrap tạm.

Nếu có enum/bảng từ lần tạo thủ công dở trước đây, kiểm kê hoặc chọn project demo mới; không tự DROP schema. Bootstrap không dành cho database đã có leads/quotes. Snapshot demo chứa bảng giá `2025-Q4-v1`, khuyến mãi năm 2025 và password user placeholder: không dùng như dữ liệu production.

`supabase/migrations/` hiện chứa migration nâng cấp, không phải baseline đầy đủ. Không dùng riêng `supabase db push` trên project trống; dùng bootstrap của repository trước.

## 5. Nâng cấp database có dữ liệu

1. Ghi commit trước/sau; backup, kiểm kê và thử môi trường staging.
2. Chạy `check`, đọc cột thiếu và public grants.
3. Chạy:

```bash
python scripts/db/migrate_supabase.py upgrade
python scripts/db/migrate_supabase.py check
```

Script chỉ chạy migration chưa có trong `supabase_migrations.schema_migrations`; version/name đã có được bỏ qua. Có khóa để hai runner không chạy đồng thời, lock timeout 5s và statement timeout 60s. Toàn bộ pending SQL cùng transaction với lịch sử: lỗi không tạo migration history giả thành công. Upgrade không đọc seed, không đổi giá, không xóa dữ liệu.

Migration hiện tại:

- Thêm `vehicle_prices.image_url VARCHAR(500)`, `roof_hex VARCHAR(7)`, nullable.
- Unique partial index `(model, version, color) WHERE effective_to IS NULL`: chỉ một bản giá hiện hành mỗi cấu hình, dù `price_version` khác nhau.
- Unique index tồn kho `(dealer_id, model, version, color)`.
- Index bao phủ 9 khóa ngoại và thứ tự thời gian leads/quotes.
- Bật RLS cho bảng ứng dụng và `chat_sessions` nếu tồn tại, thu hồi quyền bảng của PUBLIC/anon/authenticated.

Bản giá đang mở bị trùng sẽ làm migration thất bại; không tự xóa/giữ một dòng tùy ý. Cột đã tồn tại sai kiểu cũng cần migration riêng, `IF NOT EXISTS` không sửa kiểu.

Nếu P097 đã được nâng cấp từ phiên làm việc hiện tại, `upgrade` sẽ bỏ qua migration này; `check` vẫn xác nhận trạng thái. Deploy backend/frontend và chạy smoke test sau đó.

### Quyền backend và browser

Luồng hiện tại: browser → Next.js proxy → FastAPI → PostgreSQL owner/admin. Backend hiện dùng `postgres`, tiếp tục đọc/ghi sau RLS; `anon` và `authenticated` không được truy cập trực tiếp bảng. Không có public RLS policies là lựa chọn có chủ đích. Nếu chuyển backend sang role riêng, phải cấp quyền/policy tối thiểu được kiểm tra trước khi thay connection string.

RLS không thay thế auth/phân quyền FastAPI. Dashboard/auth frontend còn mock, nên chưa dùng dữ liệu khách hàng thật chỉ vì Advisor hết lỗi RLS. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 6. Kiểm tra nghiệm thu

`check` phải exit 0. SQL Editor kiểm tra bổ sung:

```sql
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema='public' AND table_name='vehicle_prices'
  AND column_name IN ('image_url','roof_hex');

SELECT model, version, color, count(*)
FROM public.vehicle_prices WHERE effective_to IS NULL
GROUP BY model, version, color HAVING count(*) > 1;

SELECT price_version, count(*) FROM public.vehicle_prices GROUP BY price_version;
SELECT count(*) FROM public.leads;
SELECT count(*) FROM public.quotes;
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

SELECT has_table_privilege('anon','public.leads','SELECT') AS anon_can_read,
       has_table_privilege('authenticated','public.quotes','UPDATE') AS user_can_update;
```

Hai kiểm tra quyền cần false; query trùng cần 0 dòng. Cột ảnh 500, màu nóc 7. Không giảm số leads/quotes sau migration.

Qua backend: `/api/v1/vehicles` trả catalog không rỗng; thử `/api/v1/configurate` với cấu hình hợp lệ và đối chiếu số tiền bằng SQL. `/health` không kiểm tra DB. Image_url/roof_hex NULL ở dữ liệu cũ là bình thường, không có giá trị tự suy đoán. Muốn ảnh/màu chính xác cần backfill đã duyệt riêng.

Advisor sau migration có thể báo INFO “RLS Enabled No Policy” và “Unused Index”: phù hợp backend-only và dữ liệu nhỏ/index mới. Không tạo public policy hoặc xóa index chỉ để hết INFO. Lỗi RLS disabled và khóa ngoại thiếu index cần được xử lý. Bảng nhỏ có thể vẫn dùng Seq Scan vì planner thấy rẻ hơn.

## 7. Cập nhật dữ liệu giá

Ba nguồn độc lập: PostgreSQL cho API; Gold CSV/vector cho chat; dữ liệu/phí frontend. Cập nhật schema không tự đồng bộ các nguồn này hoặc làm bảng giá 2025 trở thành mới.

1. Chọn bảng giá/chính sách đã duyệt, version mới, thử staging.
2. Với giá xe, đóng `effective_to` bản cũ rồi insert bản mới trong cùng transaction. Unique partial index chặn hai bản đang mở cùng cấu hình.
3. Catalog API hiện chỉ lọc `effective_to IS NULL`, không lọc `effective_from`: không mở bản giá tương lai trước ngày áp dụng.
4. Pin/phụ kiện/phí dùng khóa `model`/`code`/`province`; cập nhật/upsert kiểm tra được, không chạy seed `DO NOTHING` để đổi giá.
5. Giữ snapshot/price_version của báo giá cũ. Không kéo dài ngày ưu đãi nếu chưa duyệt.
6. Đồng bộ Gold/frontend tương ứng, rebuild và đối chiếu cùng cấu hình trên API/chat/UI.

Chạy pipeline không tự cập nhật PostgreSQL và không tự tạo lại embeddings.

## 8. Phục hồi và tạo migration mới

Rollback ứng dụng về commit trước và giữ các cột nullable nếu code cũ tương thích. Không DROP cột hoặc mở lại quyền anon để rollback code. Nếu dữ liệu bị sai, dừng ghi và restore backup vào database staging trống trước:

```bash
pg_restore -W --exit-on-error --single-transaction --no-owner --no-acl --dbname=postgres app-before-upgrade.dump
```

PG env phải trỏ tới staging. Lệnh không tự xóa bảng cũ. Kiểm tra schema, số dòng, grants/RLS, lịch sử migration và API trước khi chuyển kết nối. Restore `--no-acl` không giữ grants. Backup `public` không khôi phục migration history: đối chiếu và đánh dấu đúng version thực tế, không sao chép history mới lên một schema cũ chưa áp dụng.

Mỗi thay đổi tiếp theo tạo bằng CLI (xem `--help` của phiên bản đang dùng):

```bash
supabase migration new <descriptive_name>
```

Viết SQL vào file mới, thử staging, backup và upgrade production theo mục 5. Không chỉnh nội dung migration đã có trong lịch sử, không dùng reset/drop schema như cách nâng cấp database thật.
