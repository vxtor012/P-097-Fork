# Chuyển kết nối sang Supabase — thực hiện ngày 15/10/2026

## Kiểm tra đã hoàn tất

- Kết nối chỉ đọc bằng `MIGRATION_DATABASE_URL` thành công tới project
  `ddkeoxomfypnoqdcxwxa`, Session pooler Singapore, cổng 5432, DB `postgres`.
- Supabase đã có dữ liệu nghiệp vụ và một dataset RAG active; không cần seed local.
- Tại thời điểm kiểm tra: 104 giá xe, 7 đại lý, 58 tài khoản, 45 leads,
  33 báo giá, 316 dòng tồn kho, 1 chi nhánh và 2 cửa hàng.
- Nhánh schema cloud đã có hai migration `real_demo_integration` và
  `store_inventory_keys`; chúng không nằm trong nhánh schema local.

## Khác biệt cần tương thích

Cloud lưu phiên bằng `auth_sessions.token_hash`, idempotency bằng
`quote_requests.key` và bắt buộc `lead_id`, còn code local dùng UUID `id`.
Chi nhánh/cửa hàng thiếu cột active/địa chỉ. Đăng ký tin dùng email làm khóa và
`created_at`; lịch sử chat cũ nằm trong `business_chat_messages`.

Migration `20261015060000_bridge_legacy_business_workflows.sql` bổ sung các
cột cần thiết, giữ các khóa cũ, dùng trigger đồng bộ `key/id` và điền lead từ
báo giá cho client mới. Không drop bảng/cột cloud, không xóa bản ghi.
Lịch sử chat cũ được sao chép trong cùng DB sang định dạng của code hiện tại.
Runner nhận diện đúng lịch sử hai migration cloud và bỏ qua baseline local
`20261014070000` bị trùng bảng; không ghi giả rằng baseline local đã được chạy.

SSL được yêu cầu cho kết nối runtime Supabase; kiểm tra lại kết nối khi lấy
connection từ pool. Host/password và toàn bộ credential vẫn chỉ nằm trong `.env`.

## Trạng thái triển khai

Người dùng đã cho phép backup, migration và chuyển toàn bộ kết nối ứng dụng.

- Backup PostgreSQL 17 đã tạo tại
  `D:\LabCode\P-097-Fork\logs\supabase-before-switch-20261015.dump`, dung lượng
  2.934.075 byte; `pg_restore --list` đọc được archive. Chưa restore thử toàn bộ.
- Migration bridge đã commit. Trước khi commit, đối chiếu số dòng và fingerprint
  mọi cột gốc của các bảng nghiệp vụ: toàn bộ bản ghi cũ được giữ nguyên.
- Đã tạo 6 conversation threads từ lịch sử chat cũ trong cùng Supabase.
- `DATABASE_URL` và `MIGRATION_DATABASE_URL` đều trỏ tới project này. Backend yêu
  cầu khai báo URL, không tự fallback local. Compose dùng cùng `DATABASE_URL`,
  không còn phụ thuộc PostgreSQL local; service postgres chỉ chạy khi chọn profile `local-db`.
- Backend đã restart. `/ready` trả DB connected, schema ready và RAG dataset ready.
- Đã dừng container PostgreSQL local; frontend vẫn đọc được 7 đại lý từ Supabase.
- Kiểm tra giá: 76 giá đang hiệu lực, không thiếu pin/phí, không có lỗi tính giá.
- Đọc/ghi Supabase đã kiểm tra bằng dữ liệu tổng hợp: đăng nhập, thu hồi phiên,
  báo giá/chống trùng, duyệt, PDF, newsletter và chat đều đạt. Toàn bộ bản ghi thử
  nằm trong transaction và đã rollback; không thêm dữ liệu test vào DB vận hành.
- RAG dùng embedding thật truy xuất được 2 đoạn từ corpus Supabase. Bộ test hồi
  quy 146 test đạt; DB test riêng không trỏ Supabase.

File backup và URL local cũ (`logs/database-before-supabase.env`) được Git bỏ qua.
Không chia sẻ file dump vì có thể chứa thông tin khách hàng và tài liệu nội bộ.

Ứng dụng đang chạy tại `http://127.0.0.1:3000`, API tại `http://127.0.0.1:8000`.
Backend chạy trên máy và cấu hình Docker đã chuyển; service Render public chưa
được đổi biến môi trường/deploy vì chưa truy cập được dashboard/API của service.
Điều khiển trình duyệt bị dừng do công cụ không xác minh được URL cửa sổ.
