# Đồng bộ dữ liệu nghiệp vụ

## Nguồn dữ liệu

Các bảng PostgreSQL `public.vehicle_prices`, `battery_prices`, `accessories`,
`rolling_costs`, `promotions` là nguồn chung cho configurator và công cụ AI có
cấu trúc. `ai_data` tiếp tục chứa embedding/tài liệu RAG; giá hoặc ưu đãi trong
tài liệu không thay thế giá nghiệp vụ hiện hành.

`GET /api/v1/vehicles` trả catalog, tỉnh, phụ kiện, nguồn và thời điểm tải.
Trang chủ và chọn dòng xe đọc cùng endpoint. Frontend làm mới catalog mỗi 30
giây, giá cấu hình mỗi 15 giây và khi quay lại tab. Đây là polling, không phải
cập nhật push. Khi API lỗi/rỗng, danh mục dự phòng được ghi rõ; không thể gửi
báo giá hoặc xuất PDF từ giá chưa xác nhận.

## Tính giá và lưu báo giá

`POST /api/v1/configurate`, `POST /quotes` và `POST /quote/preview-pdf` dùng chung
`src/services/pricing.py`. Giá được tính theo đúng model/phiên bản/màu, giá pin,
phụ kiện tương thích, phí địa phương và ưu đãi còn hiệu lực. Thiếu dữ liệu pin,
phí, phụ kiện hoặc có nhiều giá hiện hành trùng nhau sẽ báo lỗi thay vì tính
bằng 0. Phiên bản giá lấy từ bản ghi giá xe, không dùng hằng số frontend.

Không tự cộng dồn ưu đãi: áp dụng ưu đãi vô điều kiện có mức giảm lớn nhất trong
phạm vi quốc gia hoặc đại lý đã chọn; ưu đãi có `conditions` cần xác nhận điều kiện. Các công
cụ AI liệt kê điều kiện; `price_vehicle_configuration` tính bằng đúng hàm backend.

Tạo báo giá cần cấu hình, thông tin khách hàng, đại lý, session và `request_id` UUID
để chống tạo trùng khi gửi lại cùng yêu cầu. Frontend gửi thêm
`price_version`/`final_price` để phát hiện giá thay đổi (HTTP 409, chưa ghi dữ liệu).
Backend không tin `price_snapshot` từ client; tính và lưu snapshot đầy đủ cùng
lead liên kết trong một transaction. Commit hoàn tất trước khi API trả thành công.
Khách chọn tỉnh đăng ký trong configurator.

PDF xem trước cũng được tính lại từ cấu hình. PDF của báo giá đã lưu sử dụng
snapshot lịch sử đã lưu, không cập nhật lại theo bảng giá mới.

## Tồn kho và thống kê

Seller và warehouse đều đọc `/api/v1/inventory`. Backend kiểm tra token, vai trò
và phạm vi đại lý của tài khoản; proxy Next.js chuyển Bearer token từ cookie
đăng nhập. Các trang quản lý làm mới mỗi 10 giây khi đang mở. Database có
`branches`, `stores`, `user_stores`; warehouse chỉ xem/sửa cửa hàng được cấp quyền,
warehouse_manager xem các cửa hàng của đại lý. Seller/admin có phạm vi tương ứng.
Tổng tồn kho demo được phân bổ sang cửa hàng, không nhân bản số lượng.
Sửa tồn kho gửi `expected_updated_at`; xung đột trả HTTP 409 và yêu cầu tải lại.

Dashboard seller thống kê từ timestamp của leads/báo giá thực, theo tuần tại
Việt Nam. Giá trị báo giá đã duyệt không được gọi là doanh thu bán xe. Khi tải
lỗi, giao diện thông báo rõ nếu đang hiển thị dữ liệu cũ.

## Chuẩn bị và kiểm tra dữ liệu

DB local đã được khởi tạo và nâng cấp theo [LOCAL_DATABASE.md](LOCAL_DATABASE.md).
Chuyển nguồn đọc sang `public` không đảm bảo các bản ghi đã có là giá thật/cập nhật.
Kiểm tra nguồn gốc và ngày hiệu lực trước khi dùng với khách hàng. Import
snapshot AI vẫn không cập nhật bảng `public`.

Kiểm tra chỉ đọc:

```powershell
.\.venv\Scripts\python.exe scripts/db/check_data_sync.py
```

Script kiểm tra số dòng, giá đang hiệu lực, phiên bản giá, giá pin còn thiếu và
khả năng tính giá. Không in URL/mật khẩu hoặc thông tin khách hàng. `ready` chỉ
phản ánh khả năng tính giá, không chứng nhận nguồn gốc hoặc độ chính xác thương
mại của dữ liệu. Nếu không kết nối được DB, kiểm tra `DATABASE_URL`, mạng và
schema; không tự chạy mock/seed để che thiếu dữ liệu.

Kiểm thử hồi quy không cần database thật:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_data_sync.py tests/test_api tests/test_agents -q
```

Kiểm thử PostgreSQL thật dùng database localhost riêng có tên kết thúc `_test`.
Leads, báo giá, duyệt, PDF lịch sử, khuyến mãi và tồn kho đều kiểm tra vai trò và
phạm vi đại lý ở backend. Phiên đăng nhập lưu trong DB, có thu hồi khi logout;
frontend dùng cookie HttpOnly và không lưu token trong localStorage.

Hội thoại dùng `conversation_threads` và session UUID ngẫu nhiên; UUID là khóa
truy cập lịch sử của khách chưa đăng nhập, cần giữ riêng. Lệnh đổi cấu hình rõ
ràng được xử lý từ catalog và cập nhật giao diện. Tư vấn tự nhiên cần AI provider;
kiến thức kỹ thuật/bảo hành cần dataset RAG. Trả góp là mô phỏng theo lãi suất,
trả trước và kỳ hạn do khách nhập, không phải chào vay từ ngân hàng.
