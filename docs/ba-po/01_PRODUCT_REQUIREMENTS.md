# PRD và đặc tả nghiệp vụ — P97

Phiên bản tài liệu: 1.0, ngày 15/10/2026. Chủ sở hữu nghiệp vụ: BA/PO. Trạng thái: **đã soạn để nhóm review**, chưa ghi nhận nhóm phê duyệt. Căn cứ hiện trạng: mã nguồn và tài liệu tại thời điểm đọc; cần đối chiếu lại với commit bàn giao.

## 1. Problem statement và giá trị sản phẩm

Người đang cân nhắc mua xe cần liên kết lựa chọn cấu hình với chi phí lăn bánh theo địa phương và biết khoản nào còn cần đại lý xác nhận. Tư vấn viên cần tiếp nhận cấu hình và yêu cầu của khách để kiểm tra báo giá trên dữ liệu nhất quán. Hiện chưa có nghiên cứu trong repository chứng minh tần suất, mức độ khó khăn hoặc số phút lãng phí. Đây là problem statement làm việc để kiểm chứng.

Product goal của checkpoint: chứng minh một luồng xuyên suốt có thể sử dụng được, từ cấu hình xe và tư vấn AI đến yêu cầu báo giá, sale xử lý và PDF. Giá trị kinh doanh kỳ vọng là giảm thao tác hỏi lại/tính lại và giúp khách hiểu chi phí hơn. Không gắn mức tăng chuyển đổi khi chưa đo.

| Nhóm | Nhu cầu/JTBD | Giá trị cần kiểm chứng | Bằng chứng cần thu |
|---|---|---|---|
| Người mua | Hiểu xe và chi phí cho một cấu hình cụ thể | Hoàn thành tác vụ, phân biệt chi phí ban đầu/định kỳ | Quan sát thao tác và câu hỏi kiểm tra hiểu |
| Tư vấn viên | Nhận yêu cầu có cấu hình và liên hệ rõ | Ít hỏi lại, kiểm tra báo giá nhanh hơn | Tác vụ so sánh, ghi nhận thời gian và lỗi |
| Quản lý đại lý | Quản trị chính sách, đánh giá hiệu quả | Nhân viên dùng lại và chi phí chấp nhận được | Pilot, phỏng vấn người có quyền mua |

## 2. Phạm vi bản nộp

**Luồng trọng tâm:** cấu hình hợp lệ; bảng chi phí; hỏi AI và lệnh đổi cấu hình được hỗ trợ; gửi yêu cầu đến đại lý đã chọn; sale xem/duyệt hoặc từ chối; PDF có nhãn/trạng thái phù hợp. Đăng nhập và quyền đại lý là điều kiện của luồng nhân viên.

**Tính năng hỗ trợ đã thấy trong mã nguồn:** quản lý khuyến mãi và tồn kho, mô phỏng trả góp, lưu lịch sử chat, đăng ký nhận tin, hiển thị xe 3D. Chỉ đưa vào demo nếu nhóm xác nhận bản live đã sẵn sàng. Chúng không phải điều kiện để kể đủ câu chuyện giá trị cốt lõi.

**Ngoài cam kết checkpoint:** thanh toán/cọc; duyệt vay ngân hàng; hợp đồng mua xe; tự động chốt giao dịch; marketplace ghép khách nhiều đại lý; FCFS giữa đại lý; tóm tắt nhu cầu AI chuyển sale nếu chưa được chứng minh; doanh thu thương mại và định giá SaaS đã xác thực.

## 3. Hành trình và ngoại lệ

| Bước | Người thực hiện | Kết quả | Ngoại lệ phải thể hiện |
|---|---|---|---|
| J1 | Khách chọn xe/phiên bản/màu/pin/tỉnh/phụ kiện | Cấu hình hiện tại | Lựa chọn không có trong catalog hoặc không tương thích |
| J2 | Hệ thống tính giá | Bảng khoản phí, ưu đãi, tổng, mốc dữ liệu | Dữ liệu thiếu/xung đột, API lỗi |
| J3 | Khách hỏi AI hoặc yêu cầu đổi cấu hình | Tư vấn có căn cứ hoặc hỏi lại | Không đủ nguồn, câu mơ hồ, nhà cung cấp lỗi |
| J4 | Khách chọn đại lý và gửi thông tin | Một yêu cầu được ghi nhận | Sai thông tin, giá đổi, retry, đại lý không hoạt động |
| J5 | Sale đăng nhập, mở yêu cầu trong phạm vi | Có đủ cấu hình và giá lưu | Ngoài quyền, phiên hết hạn |
| J6 | Sale kiểm tra và duyệt/từ chối | Lưu người xử lý, thời điểm, ghi chú | Báo giá đã xử lý hoặc không đủ căn cứ |
| J7 | Khách/sale dùng PDF theo luồng được cấp | Bản có thể đọc, giải thích được | PDF tham khảo bị hiểu là cam kết hoặc lấy nhầm giá hiện tại |

J3 là tùy chọn: người mua vẫn có thể cấu hình thủ công. J7 có nhánh PDF tham khảo trước khi gửi/duyệt, không mặc định mọi PDF đều đi sau J6.

## 4. Business rules

Các BR dưới đây mô tả logic đã đọc, không xác nhận tính đúng của chính sách thương mại. Ký hiệu **QĐ** là đề xuất/điểm cần nhóm quyết định.

| Mã | Quy tắc | Trạng thái / nguồn |
|---|---|---|
| BR01 | Giá xe theo đúng model, version, color và thời điểm: effective_from ≤ t; effective_to rỗng hoặc t < effective_to; phải có đúng một giá | Có trong pricing service |
| BR02 | Giá pin và phí tỉnh phải có; phụ kiện phải hoạt động và tương thích xe; mã phụ kiện lặp không làm tăng tiền | Có trong pricing service |
| BR03 | Mua pin cộng buy_price vào chi phí ban đầu; thuê pin không cộng buy_price và phải trình bày tiền thuê định kỳ riêng | Công cụ trả battery_rent; cách diễn đạt cần UAT |
| BR04 | Phí trước bạ = int(giá xe × registration_rate); bảo hiểm = int(giá xe × insurance_rate); cộng road_fee, inspection_fee, plate_fee | Logic hiện tại; nguồn/ý nghĩa phí phải được nghiệp vụ xác nhận |
| BR05 | Ưu đãi tự áp dụng phải active, trong khoảng ngày kể cả hai đầu, đúng xe/ALL, đúng tỉnh nếu có, đúng đại lý nếu có, conditions rỗng | Có trong pricing service |
| BR06 | Ưu đãi % tính trên giá xe, lấy phần nguyên. Chọn một ưu đãi hợp lệ có giá trị lớn nhất; không cộng dồn. Nếu hòa, thứ tự ID quyết định | Có trong pricing service |
| BR07 | Tổng = max(0, giá xe + giá mua pin nếu có + phụ kiện + các phí − ưu đãi đã chọn) | Có trong pricing service |
| BR08 | Server tính lại khi tạo báo giá; price_snapshot do client gửi không làm nguồn giá đáng tin | Có trong API |
| BR09 | Khi client gửi price_version và số tiền cũ khác kết quả server, trả xung đột để xem lại; không mô tả cơ chế này là luôn kiểm tra mọi request nếu client bỏ version | Có điều kiện trong API |
| BR10 | Cùng request_id + cùng nội dung chỉ tạo một bộ lead/báo giá; cùng key khác nội dung bị từ chối | Có trong API |
| BR11 | Lead, báo giá và bản ghi request được tạo trong cùng giao dịch; báo giá lưu snapshot giá và phiên bản | Có trong API |
| BR12 | Báo giá mới pending; chỉ pending được duyệt/từ chối; ghi người/thời gian/ghi chú; approved không có nghĩa closed_won | Có trong API và model |
| BR13 | Truy cập/ghi dữ liệu nhân viên phải theo vai trò và phạm vi đại lý | Có cơ chế trong API; cần UAT từng vai trò |
| BR14 | Preview PDF tính giá ở server; PDF báo giá đã lưu đọc snapshot; API tải bản đã lưu không yêu cầu status approved | Có trong API PDF |
| BR15 | Giá/phí/ưu đãi cấu hình cần tool cấu trúc; tài liệu RAG phục vụ tri thức văn bản; thiếu dữ liệu phải nêu giới hạn | Agent instructions và guard; cần đánh giá hành vi thực tế |
| BR16 | Lệnh đổi cấu hình phải chỉ ra kết quả được hỗ trợ, không để phản hồi cũ ghi đè cấu hình mới | Mã config action/UI, cần UAT |
| BR17 | Trả góp là mô phỏng từ giả định khách cung cấp; không tự xác nhận lãi suất ngân hàng | Công cụ/agent; tính năng hỗ trợ |
| QĐ01 | Quy ước PDF trước duyệt là “tham khảo”; nếu muốn “chính thức sau duyệt” phải định nghĩa rõ điều kiện phát hành | Chờ nhóm quyết định, không tự coi đã triển khai |
| QĐ02 | Chủ sở hữu và lịch cập nhật giá/phí/ưu đãi; ngày hết giá trị sử dụng | Chờ người phụ trách nghiệp vụ xác nhận |
| QĐ03 | Mốc hết hạn báo giá và cơ chế chuyển expired | Model có expired; chưa coi lịch chuyển hết hạn là đã có |

## 5. User stories và acceptance criteria

### US01 — Khách tự cấu hình xe

Là người mua, tôi muốn chọn cấu hình có trong catalog để xem chi phí tương ứng.

- AC01.1: Given catalog hợp lệ, when đổi một lựa chọn, then cấu hình và bảng giá phản ánh cùng lựa chọn đã được server tính thành công.
- AC01.2: Given phụ kiện không tương thích hoặc cấu hình không có giá, when tính giá, then có lỗi rõ ràng và không cho gửi như giá đã xác nhận.
- AC01.3: Given một phụ kiện bị lặp mã, then chỉ tính một lần.
- Liên kết: BR01–04, BR07; UAT01–06.

### US02 — Khách hiểu chi phí và ưu đãi

- AC02.1: Tổng khớp từng khoản và quy tắc làm tròn của fixture đã xác nhận.
- AC02.2: Mua/thuê pin hiển thị đúng chi phí ban đầu và khoản định kỳ.
- AC02.3: Không áp dụng ưu đãi hết hạn, sai đại lý/tỉnh hoặc còn điều kiện; không cộng dồn tự động.
- Liên kết: BR03–07; UAT02–09, UAT27.

### US03 — Khách dùng AI tư vấn và đổi cấu hình

- AC03.1: Khi hỏi giá cấu hình, AI dựa trên kết quả công cụ cho đúng cấu hình/ngữ cảnh.
- AC03.2: Khi thiếu trường cần thiết, AI hỏi lại hoặc dùng rõ cấu hình hiện tại, không tự gán giả định bí mật.
- AC03.3: Với lệnh đổi cấu hình được hỗ trợ, câu trả lời và giao diện khớp; phản hồi cũ không ghi đè lựa chọn mới.
- AC03.4: Khi không có nguồn hoặc tool lỗi, AI nêu giới hạn và bước tiếp theo.
- Liên kết: BR15–16; UAT10–14; AI01–20.

### US04 — Khách chủ động gửi yêu cầu

- AC04.1: Chỉ thông báo thành công sau khi server xác nhận lưu; chọn đại lý active và thông tin liên hệ hợp lệ.
- AC04.2: Cùng mã yêu cầu gửi lại không tạo thêm bản ghi; nội dung khác cùng mã bị từ chối.
- AC04.3: Khi giá thay đổi và client cung cấp version/tổng đã xem, yêu cầu xem lại trước gửi.
- AC04.4: Khách thấy mục đích để đại lý đã chọn liên hệ trước khi gửi.
- Liên kết: BR08–11, BR13; UAT15–19, UAT29.

### US05 — Sale xử lý yêu cầu trong phạm vi

- AC05.1: Sale chỉ thấy/xử lý dữ liệu được cấp; đăng xuất/hết phiên mất quyền.
- AC05.2: Duyệt/từ chối pending lưu được người xử lý, thời điểm và ghi chú; không xử lý lại như pending.
- AC05.3: Approved không tự đánh dấu bán thành công và giá trị báo giá không bị gọi là doanh thu.
- Liên kết: BR12–13; UAT20–24, UAT30.

### US06 — PDF phản ánh đúng bản báo giá

- AC06.1: PDF preview từ kết quả server; PDF lưu dùng snapshot ngay cả khi catalog thay đổi.
- AC06.2: Chữ tiếng Việt, tổng tiền, đại lý, khoản pin định kỳ và nhãn/trạng thái đọc được.
- AC06.3: Nhóm thống nhất cách gọi PDF theo QĐ01 trước quay demo; lỗi “chính thức” trên bản chưa xác nhận cần được ghi nhận để sửa hoặc điều chỉnh nội dung demo.
- Liên kết: BR14, QĐ01; UAT25–27.

### US07 — Quản trị và tính năng hỗ trợ

- AC07.1: Thay đổi ưu đãi chỉ hiệu lực trong phạm vi quyền và khoảng thời gian hợp lệ.
- AC07.2: Sửa tồn kho đồng thời không âm thầm ghi đè phiên bản mới.
- AC07.3: Mô phỏng trả góp dùng đủ giả định và không trình bày là phê duyệt vay.
- Đây là phạm vi hỗ trợ; UAT31–33 chỉ bắt buộc nếu nhóm đưa vào cam kết bản nộp.

## 6. Dữ liệu và trách nhiệm con người

| Dữ liệu/đầu ra | Nguồn có thẩm quyền cho kiểm tra | Trách nhiệm |
|---|---|---|
| Catalog/giá/phí/ưu đãi | Bảng dữ liệu và tài liệu nguồn có ngày hiệu lực do nghiệp vụ duyệt | Đại diện nghiệp vụ xác minh, dev quản lý đồng bộ |
| Giải thích kỹ thuật/bảo hành | Corpus có nguồn và phiên bản | Người phụ trách dữ liệu/AI kiểm tra, BA thiết kế tình huống |
| Quyết định duyệt | Nhân viên có quyền theo đại lý | Sale kiểm tra điều kiện thực tế |
| Báo cáo chất lượng | Ca kiểm thử + kết quả + bằng chứng gắn phiên bản | QA/dev chạy, BA/PO đánh giá tiêu chí |
| Dữ liệu nghiên cứu | Ghi chép ẩn danh có bối cảnh và sự đồng ý tham gia | BA/PO thu và tổng hợp |

## 7. Điều kiện nghiệm thu bản nộp

Đây là tiêu chuẩn PO đề xuất cho nhóm review: các ca P0 thuộc phạm vi cam kết phải chạy và đạt, có bằng chứng; không còn lỗi nghiêm trọng về số tiền, lộ dữ liệu giữa đại lý hoặc mất yêu cầu. Ca không chạy vì môi trường phải để “Bị chặn”, không chuyển thành “Đạt”. Ca P1 không đạt cần có quyết định sửa, giảm phạm vi hoặc ghi giới hạn.

Mục tiêu trải nghiệm cần đo nhưng không tự coi đã đạt: hoàn thành tác vụ không trợ giúp; khách hiểu giá tham khảo; AI thiếu nguồn biết nêu giới hạn. Chưa gắn SLA thời gian phản hồi khi chưa có baseline.

Definition of Ready để dev/QA nhận yêu cầu: US/BR rõ, fixture và kỳ vọng độc lập, phạm vi môi trường/role, người giải quyết câu hỏi nghiệp vụ. Definition of Done nghiệp vụ: triển khai đúng bản bàn giao, ca kiểm tra có kết quả, lỗi xử lý, tài liệu/demo cập nhật, PO ghi quyết định nghiệm thu.

## 8. Quyết định đang mở

DEC01 tên chính thức P97 và cách nhắc AutoQuote AI; DEC02 luồng/tính năng bản nộp; DEC03 tên và trạng thái PDF; DEC04 chủ sở hữu dữ liệu; DEC05 môi trường/tài khoản/commit UAT; DEC06 cách xử lý hạn báo giá; DEC07 người duyệt hồ sơ và đại diện nộp. Các mã này có trong workbook để bạn ghi quyết định, người xác nhận, ngày và căn cứ.
