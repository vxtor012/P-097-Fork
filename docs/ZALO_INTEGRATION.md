# Vận hành gửi báo giá Zalo

## Sử dụng

Mở `/seller/zalo`, kết nối Zalo bằng QR, chọn báo giá đã duyệt, liên kết đúng người
nhận từ danh bạ hoặc số điện thoại và ghi nhận yêu cầu nhận báo giá của khách.
Mỗi khách nhận một báo giá trong chiến dịch. Soạn lời nhắn, lưu chiến dịch, xem
trước từng người nhận rồi xác nhận gửi. Kết quả tự cập nhật; có thể tạm dừng,
tiếp tục hoặc hủy phần chưa gửi.

Mỗi tài khoản nhân viên có một kết nối Zalo, danh bạ liên kết và lịch sử riêng.
Nhân viên không cần chọn đại lý: hệ thống dùng đại lý được gán trong tài khoản,
chỉ cho gửi báo giá do nhân viên đó lập cho khách đang được giao cho họ.
Admin dùng Zalo của chính mình; có thể lọc báo giá theo đại lý. Mỗi chiến dịch
chỉ chứa báo giá của một đại lý. Admin không điều khiển phiên hoặc chiến dịch
của tài khoản nhân viên khác qua module này.
Không có gửi tự động khi đăng nhập, quét QR hoặc xem chiến dịch.

Hệ thống gửi văn bản báo giá từ giá snapshot đã được duyệt. Chọn “Đính kèm PDF
báo giá đã duyệt” để mỗi khách nhận file báo giá riêng cùng lời nhắn. Sau khi
lưu bản nháp, mở “Xem PDF báo giá đính kèm” để kiểm tra trước khi xác nhận gửi.
PDF được chụp và lưu cùng bản nháp (tối đa 1 MB/tệp), không thay đổi theo bảng
giá hoặc báo giá được sửa sau đó. Chỉ chủ chiến dịch được xem file.
Chưa có lịch gửi và hộp thư hội thoại. Tối đa 200 người nhận/chiến dịch, hiển thị
500 báo giá và 100 chiến dịch gần nhất. “Đã gửi” chưa xác nhận khách đã đọc.

## Chạy bằng môi trường hiện có

Launcher ưu tiên biến môi trường tiến trình, sau đó `.env` gốc. Frontend đọc
`frontend/.env.local` và biến môi trường tiến trình. Không tự tạo hoặc đổi giá trị,
không nạp dữ liệu mẫu và không tự chạy migration khi khởi động.

```powershell
python scripts/run_app.py --check
python scripts/run_app.py
```

Log và PID lưu ở `.runtime/`; tạo `.runtime/stop` để dừng. Backend và worker dùng
database đã khai báo. Bridge được khởi động local khi URL trỏ về localhost; URL
trỏ đến server khác thì dùng dịch vụ bridge đã có. Không đưa khóa vào frontend.

Profile `.local/app.json` trước đây chỉ được sử dụng khi người phát triển chủ động
truyền `--config .local/app.json`. Không dùng profile mẫu này để khởi chạy production.
Đường dẫn `ZALO_DATA_DIR` và `ZALO_SESSION_KEY` hiện có phải được giữ ổn định để
khôi phục phiên. Launcher không sao chép phiên đăng nhập giữa các môi trường.

## Triển khai máy chủ

Backend và worker dùng PostgreSQL chung; Node bridge dùng `zca-js@2.1.2` và một
volume SQLite nội bộ để lưu phiên mã hóa cùng nhật ký chống gửi trùng. Không cần
Electron hoặc Deplao trên máy người sử dụng.

1. Áp dụng migration theo quy trình DB hiện có (gồm migration tách kết nối
   theo nhân viên `20261017130000_zalo_staff_connections.sql` và PDF
   `20261017140000_zalo_pdf_attachments.sql`):
   `python scripts/db/migrate_supabase.py upgrade`.
2. Sử dụng các giá trị đã có: `ZALO_BRIDGE_TOKEN` ít nhất 32 ký tự và
   `ZALO_SESSION_KEY` là 32 byte ngẫu nhiên dạng hex (64 ký tự).
3. Giữ khóa mã hóa ổn định và sao lưu an toàn cùng volume.
4. Chạy `docker compose --profile zalo up --build -d`.

Bridge không public cổng Internet, chỉ backend/worker truy cập bằng token. Chạy
một replica bridge cho mỗi volume; không dùng SQLite trên NFS. Khi chạy thủ công,
Node bridge đọc biến môi trường tiến trình, không tự nạp `.env`.

## Hàng đợi và phục hồi

- Worker lấy chiến dịch active; kiểm tra lại nhân viên, phân công khách, đại lý, trạng thái duyệt, tài khoản,
  người nhận và quyền nhận tin trước khi gửi.
- Nội dung, UID và PDF (nếu chọn) được chụp khi tạo chiến dịch. Thay đổi người nhận cần tạo chiến
  dịch mới; thu hồi quyền nhận tin sẽ chặn các lượt chưa xử lý.
- Tối thiểu 60 giây giữa các lượt gửi cùng tài khoản, lưu qua restart. Đây là
  giới hạn nội bộ, không bảo đảm nền tảng cho phép mọi lượt gửi.
- ID lượt gửi là khóa chống trùng. Timeout/mất kết nối được đối soát bằng nhật ký,
  không tự gửi lại khi kết quả chưa rõ. Nhân viên kiểm tra trực tiếp trên Zalo.
- Với tệp PDF, bridge chờ kết nối nhận xác nhận tải tệp và chỉ đánh dấu đã gửi
  khi Zalo trả mã tin tệp đính kèm. Lỗi sau khi bắt đầu gửi được đối soát thủ
  công vì lời nhắn có thể đã gửi trước tệp; không tự gửi lại cả hai.
- Tạm dừng/hủy ngăn lượt chưa xử lý; một tin đang gửi có thể vẫn hoàn tất.
- Thư viện kết nối tài khoản cá nhân không phải API OA chính thức. Cần theo dõi
  thay đổi tương thích khi cập nhật thư viện hoặc triển khai máy chủ mới.

Các bài kiểm tra tự động nằm trong `tests/` và `zalo-bridge/test/`, không thuộc
giao diện hay luồng vận hành của khách hàng.

Migration theo nhân viên chỉ thay cấu trúc `zalo_contacts` và bổ sung index
trong `zalo_campaigns`; không chỉnh bảng khách hàng, báo giá hay tài khoản cũ.
Migration sẽ dừng nếu còn liên kết Zalo theo đại lý cần rà soát chủ sở hữu.
Phiên cũ theo đại lý không tự chuyển sang nhân viên; cần quét QR lại để xác
nhận đúng tài khoản cá nhân. Không sao chép khóa hoặc phiên sang cấu hình khác.
