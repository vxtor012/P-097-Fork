# Database local của workspace

> Cập nhật 15/10/2026: ứng dụng đã chuyển sang Supabase theo
> [SUPABASE_SWITCH.md](SUPABASE_SWITCH.md). Thông tin dưới đây mô tả DB local cũ,
> hiện đã dừng và giữ volume; không còn là nguồn dữ liệu của ứng dụng.

Đã khởi tạo PostgreSQL 16 + pgvector bằng Docker Desktop cho dự án này.

| Thuộc tính | Giá trị |
| --- | --- |
| Host | `localhost` |
| Port | `5433` |
| Database | `vinfast_ai` |
| User | `vinfast` |
| Password local demo | `vinfast123` |
| Container | `vinfast_postgres` |
| Compose project | `autoquote-local` |
| Volume dữ liệu | `autoquote-local_vinfast_pg_data` |

Trước khi chuyển Supabase, `.env` từng trỏ `DATABASE_URL` và `MIGRATION_DATABASE_URL` vào database này,
đặt `POSTGRES_PORT=5433` và `COMPOSE_PROJECT_NAME=autoquote-local`. PostgreSQL
chỉ publish trên loopback `127.0.0.1`. Cổng 5432 trên máy thuộc một tiến trình
PostgreSQL khác, nên dự án dùng 5433.

## Dữ liệu ban đầu

Đã nạp `scripts/db/seed.sql`, áp dụng bốn migration hiện có và tạo bộ nghiệp vụ
`autoquote-demo-v1` với mốc `2026-10-14T00:00:00`:

- 80 bản ghi giá xe thuộc VF3/VF5/VF6/VF7/VF8/VF9, phiên bản giá `2025-Q4-v1`.
- 6 giá pin, 6 phụ kiện, 7 bộ phí địa phương, 4 đại lý và 3 khuyến mãi mẫu.
- 51 tài khoản mẫu, 42 lead/chat session, 31 báo giá và 320 bản ghi tồn kho.
- 4 chi nhánh, 8 cửa hàng; phân bổ 320 bản ghi tồn kho demo vào cửa hàng.
- Mật khẩu demo được hash bcrypt thật; warehouse được cấp một cửa hàng của đại lý.

Đây là dữ liệu demo của repository, chưa được xác minh là giá/phí thương mại
hiện hành. Khuyến mãi trong seed có ngày hiệu lực năm 2025 nên không được áp
dụng cho cấu hình hiện tại năm 2026. Backend kiểm tra ngày hiệu lực khi tính giá.

Schema `ai_data` và pgvector đã được tạo; tài liệu/embedding RAG chưa được nạp.
Các công cụ AI đọc giá/phí/ưu đãi nghiệp vụ dùng được dữ liệu `public` ngay.

## Chạy và kiểm tra

Khởi động Docker Desktop rồi chạy ở thư mục gốc:

```powershell
docker compose up -d postgres
.\.venv\Scripts\python.exe scripts/db/migrate_supabase.py check
.\.venv\Scripts\python.exe scripts/db/check_data_sync.py
.\.venv\Scripts\python.exe scripts/db/mock_data.py check
```

Khởi động backend khi cổng 8000 chưa có server:

```powershell
.\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8000
```

Frontend dùng `BACKEND_URL=http://localhost:8000` trong `frontend/.env.local`:

```powershell
cd frontend
npm.cmd run dev
```

Tài khoản demo:

- Admin: `demo.admin@example.invalid`, mật khẩu `123456`.
- Seller: `demo.seller.d1000000-0000-0000-0000-000000000001@example.invalid`, mật khẩu `123456`.
- Warehouse: `demo.warehouse.d1000000-0000-0000-0000-000000000001@example.invalid`, mật khẩu `123456`.

Tài khoản và mật khẩu này chỉ dành cho môi trường local demo.
`.env` local dùng `APP_ENV=development` và `JWT_SECRET` riêng. Trong production,
backend chặn tài khoản `@example.invalid`; phải cấp tài khoản nhân viên thật.
Đăng nhập tạo phiên DB; logout thu hồi phiên và token cũ không còn dùng được.

Khi khởi tạo DB local mới, sau bootstrap/migration, có thể cấp tài khoản và tổ
chức demo bằng script chỉ cho phép host localhost:

```powershell
$env:LOCAL_DEMO_PASSWORD = "123456"
.\.venv\Scripts\python.exe scripts/db/setup_local_accounts.py
Remove-Item Env:LOCAL_DEMO_PASSWORD
```

Script chỉ cấp mật khẩu cho tài khoản demo đang bị vô hiệu hóa, không đổi mật
khẩu đã có. Có thể chạy lại để bổ sung tổ chức demo; không nhân bản tồn kho.
DB `autoquote_review_test` dành riêng cho kiểm thử và không phải DB phục vụ ứng dụng.

## Giữ dữ liệu

```powershell
docker compose stop postgres
docker compose start postgres
```

Dữ liệu được giữ trong named volume qua các lần stop/start. Xóa volume sẽ xóa
database. Các lệnh khởi tạo/seed chỉ dành cho DB mới; DB đã có dùng `check` và
`upgrade`, tránh chạy lại seed làm thay đổi dữ liệu hiện có.
