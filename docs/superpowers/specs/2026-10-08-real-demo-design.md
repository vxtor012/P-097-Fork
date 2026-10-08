# Hoàn thiện demo với dữ liệu thật

## Mục tiêu và phạm vi

Hoàn thiện các tính năng đang có trong dự án để demo bằng FastAPI và PostgreSQL trên Supabase. Giữ bố cục giao diện hiện tại. Backend đã được người dùng deploy; phát triển local trước, cung cấp migration và hướng dẫn cập nhật backend. Không coi build thành công là bằng chứng deployment đã được cập nhật.

Thay toàn bộ mock nghiệp vụ đang được sử dụng: đăng nhập, phân quyền, dashboard seller, lead, báo giá, khuyến mãi, kho seller, kho cửa hàng, yêu cầu báo giá, newsletter và giá configurator. Giữ asset xe và metadata trình bày tĩnh; giá, phí, khuyến mãi và tồn kho phải lấy từ backend. Không tự thay đổi dữ liệu AI riêng hay các thay đổi đang có trong chat-panel, graph và vinfast_tools.

## Kiến trúc

Giữ Browser → Next.js API proxy → FastAPI → PostgreSQL. Frontend không truy cập bảng Supabase trực tiếp. Proxy chuyển tiếp cookie phiên đăng nhập, mã lỗi và PDF, có timeout; không trả nội dung lỗi có khóa hoặc chuỗi kết nối. Tận dụng SQLAlchemy và các bảng nghiệp vụ hiện có.

Chọn xác thực tại FastAPI với users hiện tại, mật khẩu băm và phiên đăng nhập được lưu trong database, cookie HttpOnly có hạn sử dụng. Đây là lựa chọn tích hợp với mô hình hiện tại; không tạo một hệ thống Supabase Auth song song. Đăng xuất thu hồi phiên, tài khoản bị vô hiệu hóa không được truy cập. Backend kiểm tra vai trò và phạm vi đại lý/cửa hàng cho mọi API nội bộ. Frontend chỉ dùng thông tin hồ sơ để hiển thị, không quyết định quyền truy cập thay backend.

## Tổ chức và dữ liệu

Bổ sung branches, stores, quan hệ user–store, sessions, newsletter_subscriptions; bổ sung store_id cho inventory và vai trò warehouse_manager. Ràng buộc cửa hàng thuộc đúng chi nhánh/đại lý, số lượng kho không âm, email đăng ký duy nhất. Tạo index cho khóa ngoại và truy vấn theo phạm vi/thời gian.

Migration phải cộng thêm, có lịch sử và kiểm tra tương thích dữ liệu cũ. Inventory chưa có store_id tiếp tục được nhận diện là tồn kho cấp đại lý, không nhân bản số lượng sang mọi cửa hàng. Dữ liệu tổ chức thật phải được cấu hình trước khi demo kho cửa hàng. Không seed hoặc xóa dữ liệu trên database đang dùng khi khởi động. Công cụ tạo tài khoản demo phải là lệnh chủ động, dùng mật khẩu người vận hành cung cấp và hash theo cùng cơ chế đăng nhập.

Giữ RLS và quyền bảng riêng cho backend như cấu hình hiện tại; không mở bảng nghiệp vụ cho anon/authenticated. Mọi migration có hướng dẫn backup, chạy kiểm tra và rollback phù hợp; enum mới không được đưa vào một transaction sử dụng ngay khi PostgreSQL chưa cho phép.

## Giá và yêu cầu báo giá

Catalog API cung cấp xe, phiên bản, màu, phụ kiện và địa phương/biểu phí từ database. Configurator gọi API tính giá khi cấu hình thay đổi, loại bỏ response cũ đến trễ; khi đang tải hoặc lỗi, không cho gửi yêu cầu dựa trên giá tĩnh. Backend kiểm tra battery, phụ kiện tương thích và bản giá có hiệu lực; tính khuyến mãi theo thời gian và đại lý được chọn. Không còn ưu đãi tháng 10 hard-code.

Khách chọn đại lý nhận yêu cầu từ danh sách hoạt động. Một API tiếp nhận thông tin khách và cấu hình: backend tính lại giá, lưu snapshot, tạo lead và quote liên kết trong một transaction. Request có khóa idempotency; retry cùng payload không tạo thêm lead/quote, cùng khóa khác payload bị từ chối. Validate số điện thoại, tên, địa phương và dealer_id. Form chỉ hiện thành công sau khi commit được xác nhận; thất bại giữ thông tin cho khách thử lại. Đồng nhất hành vi các nút yêu cầu báo giá ở configurator và chat; nếu chat thiếu cấu hình cần thiết, dẫn khách hoàn thiện cấu hình trước khi gửi.

Newsletter lưu đăng ký thật, chống đăng ký trùng và phản hồi sau khi backend hoàn thành. Không hứa gửi email hay liên hệ trong 30 phút khi chưa có dịch vụ tương ứng.

## Seller và kho

Dashboard lấy số liệu tổng hợp, biểu đồ và hoạt động từ database theo đại lý hiện tại. Không dựng tin nhắn hội thoại hoặc doanh thu từ mock; doanh thu dự kiến nếu hiển thị phải ghi đúng ý nghĩa và tính từ trạng thái nghiệp vụ có thật. Seller xem/cập nhật lead, duyệt/từ chối quote và quản lý khuyến mãi trong phạm vi đại lý. Thay đổi trạng thái và ghi chú được lưu, tải lại vẫn còn. Quote chỉ chuyển trạng thái theo quy tắc đã xác định; cập nhật lead liên quan khi duyệt báo giá không tự đánh dấu bán thành công.

Seller xem kho của đại lý; thủ kho chỉ đọc/sửa các cửa hàng được gán; quản lý kho đọc/sửa toàn bộ cửa hàng thuộc đại lý. Scope phải kiểm tra ở backend kể cả khi người dùng tự thay ID trên request. Cập nhật số lượng kho kiểm tra phiên bản/updated_at để tránh ghi đè âm thầm giữa hai người dùng.

Frontend có loading, empty, error và thao tác thử lại cho từng màn. Sau mutation làm mới dữ liệu liên quan; dashboard/lead/quote kiểm tra thay đổi khoảng 10 giây khi tab đang hiển thị và làm mới khi quay lại tab. Ngừng polling khi tab ẩn hoặc đăng xuất. Không cần bổ sung Supabase Realtime cho demo này.

## PDF

API xuất PDF tạo và trả bytes thực từ snapshot báo giá lưu trong database, font hỗ trợ tiếng Việt, tên khách, cấu hình, chi phí, trạng thái và ghi chú seller. Nội dung snapshot không thay đổi theo bảng giá mới. Proxy trả đúng content-type và content-disposition. Chỉ người có quyền với báo giá được tải; không trả đường dẫn tệp chưa tồn tại.

## Kiểm thử và bàn giao

Kiểm thử backend cho đăng nhập/thu hồi phiên, quyền giữa hai đại lý và giữa cửa hàng, tính giá, rollback lead–quote, idempotency, trạng thái duyệt, CRUD khuyến mãi, xung đột cập nhật kho, newsletter trùng và PDF tiếng Việt. Kiểm tra schema/migration trên database thử nghiệm trước khi áp dụng database đang dùng.

Frontend phải typecheck, lint các file thay đổi và production build; xác minh luồng trên trình duyệt với hai phiên khách/seller và tài khoản kho. Kịch bản nghiệm thu: gửi cấu hình mới → seller thấy lead và quote trong tối đa một chu kỳ refresh → duyệt → tải PDF mở được → sửa khuyến mãi và kiểm tra giá mới → sửa kho và tải lại → đăng xuất và thử truy cập API bị từ chối. Lỗi backend không được hiện thành công hoặc lùi về mock.

Bàn giao code, migration, biến môi trường mẫu, lệnh tạo tài khoản demo, hướng dẫn chạy local/deploy và kết quả kiểm thử. Biến cần kiểm tra tại máy: DATABASE_URL, MIGRATION_DATABASE_URL, BACKEND_URL và cấu hình provider AI. Khóa bí mật chỉ ở backend; không yêu cầu gửi giá trị vào chat. Chưa xác nhận demo trên backend đã deploy nếu chưa chạy nghiệm thu với URL đó.

## Thứ tự thực hiện

1. Schema, migration, xác thực và quyền theo tổ chức.
2. Catalog/giá thật và API tạo lead–quote nguyên tử.
3. Proxy, form khách và newsletter.
4. Seller, khuyến mãi và kho với dữ liệu thật.
5. PDF, kiểm thử tích hợp và hướng dẫn demo/deploy.

Thực hiện trong chat hiện tại theo thứ tự phụ thuộc; không tạo chat khác. Không triển khai thêm thanh toán, CRM bên ngoài, email/SMS hoặc hệ thống quản trị mới ngoài các luồng hiện có.
