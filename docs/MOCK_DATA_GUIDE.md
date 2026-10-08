# Dữ liệu demo thống nhất

## Phạm vi

`scripts/db/mock_data.py` tạo một bộ nghiệp vụ có cùng danh tính, phiên, cấu hình, số tiền, trạng thái và thời gian xuyên suốt:

```text
users (buyer) ← chat_sessions.config_snapshot.buyer_id
                     │ session_id
                     ▼
                   leads → assigned_to → users (seller) → dealers
                     │ lead_id
                     ▼
                   quotes → seller_id → cùng seller và đại lý

inventory → dealers + users (warehouse) + cấu hình trong vehicle_prices
```

Các dòng nghiệp vụ có dấu `autoquote-demo-v1`. Đây là dữ liệu giả lập, không phải khách hàng, tồn kho hoặc giao dịch thực tế.

| Dữ liệu | Hành vi |
| --- | --- |
| Giá xe, pin, phụ kiện, phí, promo | Chỉ đọc; không đổi giá, ngày hiệu lực, conditions hoặc usage count |
| Đại lý và users đã tồn tại | Giữ toàn bộ nội dung và ID, gồm password và người tạo promo |
| Buyer/staff còn thiếu | Tạo bằng ID ổn định, email `example.invalid`, password vô hiệu hóa |
| Leads/quotes đã xác nhận là mock | Tạo lại nội dung liên kết, giữ toàn bộ ID cũ, không xóa dòng |
| Hội thoại/tồn kho | Tạo bộ demo; từ chối ghi nếu có dòng chưa được đánh dấu mock |
| Pipeline lakehouse/Gold và schema khác | Không truy cập/không thay đổi |

Buyer ở `public.users` không phải tài khoản Supabase Auth trong `auth.users`. Script không tạo tài khoản đăng nhập hay đổi quyền truy cập.

## 1. Chuẩn bị

Chạy từ thư mục gốc repo với Python/dependencies đã cài. Cấu hình `MIGRATION_DATABASE_URL` và SSL theo [database guide](SUPABASE_DATABASE_GUIDE.md). Backup bằng `pg_dump` theo tài liệu đó trước khi sửa dữ liệu cũ. Đối chiếu host/database được script in ra.

```bash
python scripts/db/migrate_supabase.py check
python scripts/db/migrate_supabase.py upgrade
python scripts/db/migrate_supabase.py check
python scripts/db/mock_data.py --help
```

Upgrade chỉ cập nhật schema. Migration `add_demo_chat_sessions` tạo bảng hội thoại nếu chưa có, giữ bảng/dữ liệu đã tồn tại, bật RLS và thu hồi quyền browser. Không tự nạp mock vào DB cũ.

Phải có đại lý hoạt động, bảng giá xe hiệu lực, và phí tỉnh tương ứng hoặc `Tỉnh khác`. Script không bịa catalog thiếu để chạy cho qua.

## 2. Database mới

```bash
python scripts/db/migrate_supabase.py bootstrap --seed
python scripts/db/mock_data.py check
```

Bootstrap tạo schema, nạp catalog `seed.sql`, rồi tạo bộ mock nghiệp vụ trong cùng transaction. DB đã có bảng thì không bootstrap lại. Catalog snapshot năm 2025 chỉ phục vụ demo; cập nhật dữ liệu nguồn bằng pipeline/quy trình riêng.

Docker Compose mới chỉ nạp schema và catalog SQL. Sau khi PostgreSQL sẵn sàng, chạy các lệnh ở mục 3 trên máy quản trị, với URL trỏ DB local. Không xóa volume để nạp lại mock.

## 3. Có catalog, chưa có dữ liệu nghiệp vụ

Dùng cùng mốc UTC cho plan/apply. Ví dụ dưới đây dùng mốc triển khai bộ demo; có thể chọn ngày khác sau ngày hiệu lực catalog.

```bash
python scripts/db/mock_data.py plan --as-of 2026-10-08T00:00:00
# Thay <plan-sha256> bằng plan_sha256 trong kết quả vừa xem:
python scripts/db/mock_data.py apply --as-of 2026-10-08T00:00:00 --expected-plan-sha256 '<plan-sha256>'
python scripts/db/mock_data.py check
```

Plan chỉ đọc, báo số dòng dự kiến, fingerprint sáu bảng được bảo vệ và hash kế hoạch. `--expected-plan-sha256` khiến apply dừng nếu dữ liệu nguồn/nghiệp vụ thay đổi sau lúc xem kế hoạch. Nếu hash đổi, xem lại kế hoạch mới.

Mặc định có ít nhất 42 buyers/hội thoại/leads và 31 quotes. Mỗi đại lý có seller/warehouse; nhân sự phù hợp đã tồn tại được tái sử dụng. Mỗi cấu hình hiện hành có một dòng tồn kho demo ở mỗi đại lý hoạt động. Số users/tồn kho tùy DB, không hardcode ID dự án Supabase.

## 4. Sửa bộ mock cũ

Chỉ dùng cờ adoption khi đã xác nhận **toàn bộ leads/quotes hiện có là giả**, đã backup và không lẫn giao dịch thật. Script thay nội dung danh tính, cấu hình, trạng thái nhưng giữ ID; không tự đoán dòng nào là khách hàng thật.

```bash
python scripts/db/mock_data.py plan --adopt-existing-mock --as-of 2026-10-08T00:00:00
python scripts/db/mock_data.py apply --adopt-existing-mock --as-of 2026-10-08T00:00:00 --expected-plan-sha256 '<plan-sha256>'
python scripts/db/mock_data.py check
```

Không có cờ adoption thì script từ chối leads/quotes chưa có dấu mock. Dù có cờ, chat/tồn kho chưa có dấu mock vẫn khiến script dừng để xử lý riêng và giữ dữ liệu hiện có. Không tự gắn dấu mock vào dòng chưa rõ nguồn gốc.

## 5. Chạy lại và kiểm tra

Sau adoption đầu tiên, dùng mục 3, không cần cờ adoption. Cùng dữ liệu nguồn và `--as-of` cho cùng ID, số lượng và nội dung nghiệp vụ; không sinh trùng. Đổi mốc/catalog tạo kế hoạch khác và cập nhật kịch bản demo.

Toàn bộ ghi, khóa và kiểm tra nằm trong transaction; lỗi rollback toàn bộ. Catalog được khóa trong lúc ghi để pipeline không thay đổi giữa chừng. Lock timeout 5s, statement timeout 60s; nếu timeout, kiểm tra transaction đang chạy rồi lập lại kế hoạch.

`check` chỉ đọc, in số dòng và lỗi của 7 nhóm:

1. Lead có chat/buyer tồn tại, cùng danh tính.
2. Lead có seller đúng đại lý/tỉnh.
3. Quote có lead/chat/seller, cùng phiên, danh tính, cấu hình, pin và phụ kiện.
4. Cấu hình/phiên bản giá tồn tại, tổng tiền khớp snapshot.
5. Thứ tự thời gian và trạng thái lead/quote hợp lý.
6. Tồn kho khớp cấu hình/màu/warehouse và không âm.
7. Không nhiều leads dùng chung session.

Exit 0 khi đạt, exit 1 khi có lỗi. Đọc cả số dòng: DB rỗng không có lỗi liên kết nhưng cũng chưa có demo.

Quotes bao phủ pending/approved/rejected/expired; leads tương ứng quoted/closed_won/closed_lost và các leads new/contacted chưa có quote. Snapshot dùng công thức `/api/v1/configurate`: giá xe + pin mua + phụ kiện + phí − promo đúng model/tỉnh/ngày. Pin thuê không cộng tiền thuê hàng tháng vào giá mua. Snapshot lưu ID giá nguồn, phiên bản, chi tiết phí/promo và thời điểm tính; không tăng usage count promo.

## 6. Giới hạn khi kiểm thử

- Buyer liên kết bằng JSON `config_snapshot.buyer_id`, không phải khóa ngoại mới. Seed/check xác minh liên kết này.
- Frontend auth/dashboard vẫn có mock riêng; dashboard không tự phản ánh dữ liệu Supabase vừa nạp.
- Chat runtime dùng LangGraph MemorySaver, chưa ghi bảng chat_sessions. API tạo lead/quote chưa tự bảo đảm cả chuỗi trên. Dữ liệu mới tạo trong lúc test có thể khiến check báo lỗi; không adoption dữ liệu thật để chữa lỗi.
- API tính promo hiện xét model/tỉnh/thời gian, chưa lọc dealer_id hay diễn giải conditions. Mock theo API, giữ chính sách nguồn nguyên vẹn; cần hoàn thiện nghiệp vụ trước khi báo giá thật.
- Accounts mới dùng `!disabled-demo-account`, không có mật khẩu demo công khai và không chứng minh auth đã hoàn chỉnh.

## 7. Kết quả áp dụng

Ngày 08/10/2026 trên P097: giữ ID 42 leads/31 quotes; bổ sung 42 buyers/42 hội thoại và nhân sự thiếu; 312 dòng tồn kho = 52 cấu hình × 6 đại lý; tổng 55 users. Quotes: 8 pending, 8 approved, 8 rejected, 7 expired. Bảy nhóm kiểm tra không lỗi. Fingerprint sáu bảng được bảo vệ và nội dung năm users cũ không đổi.

Đây là kết quả tại thời điểm áp dụng. Project khác lấy số liệu từ plan/check, không sao chép ID hoặc connection string của P097.
