# Rà soát và hoàn thiện tính năng — 14/10/2026

> Cập nhật 15/10/2026: kết nối ứng dụng đã chuyển sang Supabase, RAG đã truy xuất
> được dữ liệu thật. Xem [kết quả chuyển DB](SUPABASE_SWITCH.md). Phần dưới ghi nhận
> trạng thái của đợt rà soát ngày 14/10 trước khi chuyển.

Đợt này hoàn thiện các luồng hiện có trên workspace local. Backend Render chưa
được cập nhật bằng các thay đổi này. Ứng dụng local phục vụ từ PostgreSQL
`vinfast_ai` trên `localhost:5433`; bộ bản ghi ban đầu vẫn là dữ liệu demo.

## Kết quả theo luồng

| Luồng | Tình trạng đã triển khai |
| --- | --- |
| Chọn và cấu hình xe | Catalog API, giá theo phiên bản/màu, pin, phụ kiện, tỉnh và đại lý; làm mới định kỳ; lỗi API được hiển thị và chặn gửi từ giá chưa xác nhận |
| Yêu cầu báo giá | Chọn đại lý, kiểm tra thông tin khách; backend tính lại giá, lưu lead + snapshot + báo giá trong một giao dịch; chống tạo trùng bằng request UUID |
| CRM | Danh sách theo đại lý; tiếp nhận khách, trạng thái, ghi chú và phân công có kiểm tra nhân viên cùng đại lý |
| Duyệt báo giá | Seller/admin theo phạm vi; từ chối xử lý lại; lưu ghi chú/người duyệt; duyệt không tự biến thành bán xe thành công |
| PDF | Xem trước tính lại giá; bản đã lưu dùng snapshot lịch sử; PDF tiếng Việt, dữ liệu đầu vào được escape, đại lý lấy từ dữ liệu; tải lịch sử cần đăng nhập |
| Khuyến mãi | Tạo/sửa/bật/tắt theo quyền đại lý; kiểm tra khoảng ngày và mức giảm; lấy ưu đãi hợp lệ lớn nhất; lượt áp dụng đếm từ báo giá thực, không từ số mẫu |
| Tồn kho | Chi nhánh/cửa hàng và cấp quyền; warehouse chỉ được cửa hàng đã cấp; sửa số lượng/lịch giao; phát hiện sửa đồng thời bằng timestamp |
| Dashboard | Leads/báo giá thật theo phạm vi, biểu đồ theo timestamp; giá trị báo giá đã duyệt được phân biệt với doanh thu |
| Đăng nhập | Bcrypt và hash legacy hợp lệ; phiên DB có hết hạn/thu hồi; cookie HttpOnly; role cookie tự sửa không cấp quyền; xóa cache khi đổi phiên |
| Chat | Lưu lịch sử DB và khôi phục khi tải lại; lệnh đổi cấu hình rõ ràng dùng catalog/giá chung và cập nhật giao diện; chống áp dụng câu trả lời cũ lên cấu hình mới |
| Trả góp | API, giao diện và tool AI dùng cùng hàm mô phỏng; khách nhập lãi suất, trả trước và kỳ hạn; lịch trả về dư nợ bằng 0, hỗ trợ lãi suất 0% |
| Đăng ký nhận tin | Lưu email và sự đồng ý, chuẩn hóa và chống trùng; thông báo thành công sau khi commit |
| Xem xe 3D | Sửa màu sau khi model tải xong, tự xoay, fallback khi WebGL lỗi và giải phóng tài nguyên khi đổi model |

Các trang nhân viên polling mỗi 10 giây khi mở; catalog 30 giây, giá cấu hình
15 giây. Đây là cập nhật định kỳ, chưa có push/WebSocket.

## Kiểm chứng

- Bộ kiểm thử Python: 144 test đã đạt, gồm kiểm thử nghiệp vụ và RAG/pgvector trên
  PostgreSQL thật riêng `autoquote_review_test`. Các lần kiểm tra sau sửa cuối
  chạy lại nhóm bị ảnh hưởng. Test tích hợp rollback, không ghi vào DB ứng dụng.
- Ruff backend, ESLint frontend, TypeScript và Next.js production build đã đạt.
- Qua HTTP trên ứng dụng local: trang công khai, chuyển hướng trang có quyền,
  cookie HttpOnly, chặn role cookie giả, chặn Origin khác, đăng nhập/logout,
  phạm vi kho, tính giá/trả góp, gửi lại báo giá, duyệt/tải PDF, đăng ký nhận tin,
  đổi cấu hình từ chat và lịch sử hội thoại đều được kiểm tra.
- Chat với nhà cung cấp AI thật trả lời câu hỏi giá VF 6 Plus bằng catalog local.
- PDF mẫu đã render và kiểm tra trực quan: một trang, chữ tiếng Việt, đại lý,
  phí, thuê pin định kỳ và tổng tiền hiển thị rõ.
- Kiểm tra schema local không thiếu cột, không có quyền bảng public ngoài dự
  kiến, không thiếu index FK/unique. Các bản ghi nghiệp vụ ban đầu được giữ lại.
- CI bổ sung PostgreSQL/pgvector và frontend lint/typecheck/build. Chưa chạy
  workflow này trên GitHub; Docker image Linux cũng chưa build trong đợt này.
- Chưa kiểm tra thao tác giao diện bằng trình duyệt tương tác; môi trường hiện
  không cung cấp browser khả dụng. HTTP/build không thay thế hoàn toàn kiểm tra
  bố cục trên điện thoại hoặc WebGL thực tế.

## Việc còn phụ thuộc dữ liệu và triển khai

1. Nạp dataset tài liệu/embedding RAG được kiểm duyệt để tư vấn kỹ thuật, pin/sạc
   và bảo hành. `/ready` local hiện báo `rag_dataset_ready=false`; test dùng corpus
   tổng hợp kiểm tra cơ chế, không tạo kho tri thức thương mại cho ứng dụng.
2. Xác minh/thay bộ giá, phí, tồn kho và khuyến mãi demo bằng dữ liệu vận hành.
   Phiên bản seed `2025-Q4-v1` không chứng nhận giá thương mại năm 2026.
3. Cấp tài khoản nhân viên/cửa hàng thật; production chặn email demo
   `@example.invalid`. `JWT_SECRET` production phải có ít nhất 32 ký tự ngẫu nhiên.
4. Khi đưa lên cloud: backup, áp dụng migration mới vào đúng DB đích, cấu hình
   secret, deploy cả backend/frontend rồi kiểm tra toàn luồng. Chưa thực hiện
   deploy/ghi dữ liệu vào backend Render trong đợt này.

Đăng ký nhận tin hiện lưu danh sách đăng ký; chưa tích hợp gửi email chiến dịch.
Trả góp là mô phỏng, chưa có tích hợp duyệt vay/ngân hàng. Hướng dẫn chi tiết ở
[DB local](LOCAL_DATABASE.md), [đồng bộ dữ liệu](DATA_SYNC.md) và
[triển khai cloud](CLOUD_DEPLOYMENT.md).
