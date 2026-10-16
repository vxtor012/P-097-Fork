# Hướng dẫn UAT, đánh giá AI và discovery

Chủ trì: BA/PO. Dùng cùng `P97_BA_PO_Workbook.xlsx`. Đây là kế hoạch và ca đã thiết kế; chưa phải báo cáo kết quả.

## 1. Việc làm ngay khi team đang phát triển

- Phỏng vấn vấn đề và xem cách người mua/sale đang làm hiện tại. Không cần chờ sản phẩm.
- Nhờ người phụ trách nghiệp vụ xác nhận ý nghĩa từng khoản phí, nguồn giá, cách tính pin và ưu đãi. Ghi DEC04 nếu còn thiếu.
- Review bộ ca UAT với dev để chuẩn bị fixture và tài khoản kiểm thử. BA không tự đổi dữ liệu vận hành để tạo tình huống.
- Chuẩn bị tác vụ, biểu mẫu và cách chấm. Chờ bản ổn định mới đo thao tác sản phẩm.

## 2. Bàn giao cần có để bắt đầu UAT

Một URL/môi trường rõ ràng, commit/build, bộ dữ liệu có version, tài khoản sale của hai đại lý, người hỗ trợ khi lỗi và danh sách lỗi đã biết. Các ca thay đổi giá, giả lập lỗi hoặc thử đồng thời chỉ chạy ở môi trường test được team chuẩn bị. Nếu chỉ có bản public với dữ liệu thật, để ca tương ứng “Bị chặn” và nhờ dev/QA cung cấp bằng chứng từ môi trường test.

Chạy mỗi ca theo thứ tự: đọc tiền điều kiện → ghi version/môi trường → thực hiện → ghi thực tế và thời gian → đính ảnh/video/log đã ẩn dữ liệu riêng → chọn trạng thái. Khi chạy lại, giữ lịch sử kết quả trong bản sao/dòng mới có run_id, không xóa lỗi cũ để tạo cảm giác chưa từng lỗi.

## 3. Fixture độc lập cho giá

**FX01 là dữ liệu tổng hợp thiết kế riêng để kiểm tra công thức, không phải giá hoặc phí thương mại thực.** Nhờ dev/QA dựng trong môi trường test, tuyệt đối không seed đè lên dữ liệu đang dùng của nhóm.

| Trường | Giá trị |
|---|---:|
| Xe/phiên bản/màu | TEST-CAR / TEST-V1 / Trắng |
| Tỉnh/đại lý | TEST-PROVINCE / DEALER-A |
| Giá xe | 500.000.000đ |
| Mua pin | 80.000.000đ |
| Thuê pin | 1.200.000đ/tháng |
| Một phụ kiện tương thích | 10.000.000đ |
| Tỷ lệ trước bạ tổng hợp | 10% |
| Phí đường bộ | 1.560.000đ |
| Đăng kiểm | 340.000đ |
| Tỷ lệ bảo hiểm tổng hợp | 1% |
| Biển số | 20.000.000đ |
| Ưu đãi A | Giảm cố định 20.000.000đ, hợp lệ, không điều kiện |
| Ưu đãi B | Giảm 3% giá xe = 15.000.000đ, hợp lệ, không điều kiện |

Tổng phí = 50.000.000 + 1.560.000 + 340.000 + 5.000.000 + 20.000.000 = **76.900.000đ**. Chọn A, không cộng B.

- Mua pin, có phụ kiện: 500.000.000 + 80.000.000 + 10.000.000 + 76.900.000 − 20.000.000 = **646.900.000đ**.
- Thuê pin, có phụ kiện: **566.900.000đ ban đầu**, trình bày **1.200.000đ/tháng riêng**.
- Mua pin, không phụ kiện: **636.900.000đ**.
- Mua pin, có phụ kiện, không có ưu đãi hợp lệ: **666.900.000đ**.

Nguồn chuẩn của ca giá là phép tính độc lập trên, không chép số từ chính ứng dụng làm kỳ vọng. Nếu nghiệp vụ yêu cầu cách tính khác, ghi change request và sửa fixture/kỳ vọng sau khi quyết định, không đổi kết quả chỉ để ca đạt.

## 4. Đánh giá AI

Workbook chứa 20 tình huống. Với ca có tính ngẫu nhiên, chạy tối thiểu ba lần cho bản ứng viên cuối và lưu từng lần bằng mã AIxx-R1/R2/R3. Cách đơn giản là lưu ba bản workbook theo run; các bộ đếm trong file tính trên các dòng đã chuẩn bị. Nếu thêm ca/dòng ngoài vùng hiện có, cần mở rộng vùng công thức tổng hợp trước khi dùng số đếm. Đây là kiểm tra độ ổn định ban đầu, không đủ chứng minh tỷ lệ lỗi toàn hệ thống. Ghi provider/model cấu hình thực tế cùng commit. Không suy ra mô hình đang chạy chỉ từ giá trị mặc định trong mã.

Chấm từng câu theo bốn tiêu chí: (1) đúng ý và cấu hình, (2) số tiền/khẳng định có nguồn hỗ trợ, (3) biết hỏi lại/nêu giới hạn, (4) không tự xác nhận điều kiện thương mại. Nếu sai số tiền, sai điều kiện hưởng ưu đãi, lẫn ngữ cảnh xe hoặc làm lộ dữ liệu riêng: chọn Không đạt dù câu viết trôi chảy. Một lần sai phải được ghi nhận, không chỉ giữ câu trả lời tốt nhất.

Với RAG, người chấm cần tài liệu chuẩn chứa câu trả lời và đoạn truy xuất nếu có. Tool đã gọi thành công không tự chứng minh câu trả lời đúng. Với câu không có nguồn, kết quả đúng có thể là thừa nhận giới hạn; tách nhóm này khỏi tỷ lệ trả lời đầy đủ.

## 5. Phiên discovery 20 phút

Tuyển 3–5 người tìm hiểu mua xe và 2–3 sale nếu tiếp cận được. Quy mô là mục tiêu tiện dụng, không yêu cầu BTC. Ghi vai trò thật; bạn học đóng vai được tính usability với người đóng vai.

Lời mở đầu: “Mình đang tìm hiểu cách anh/chị tra cứu hoặc lập báo giá xe. Buổi này khoảng 20 phút. Mình xin ghi chép ẩn danh để cải thiện dự án. Anh/chị có thể bỏ qua câu hỏi hoặc dừng bất cứ lúc nào. Anh/chị có đồng ý không?” Chỉ ghi âm khi đã xin riêng và được đồng ý.

1. Kể lại lần gần nhất tìm giá hoặc lập báo giá, từ lúc bắt đầu đến kết quả.
2. Đã dùng nguồn nào và ai cần xác nhận?
3. Bước nào phải hỏi/làm lại? Có ví dụ đã ẩn thông tin cá nhân không?
4. Khoản phí, pin, ưu đãi nào khó hiểu nhất?
5. Khi nào thấy đủ tin cậy để gửi thông tin liên hệ hoặc chuyển báo giá cho khách?
6. Với quản lý: ai quyết định mua phần mềm và cần thấy bằng chứng gì?

Ghi câu trả lời vào tab Discovery: quan sát nguyên gốc tách khỏi diễn giải của BA. Không ghi “đã xác thực” chỉ vì người tham gia khen ý tưởng.

## 6. Usability khi bản ổn định có sẵn

Tác vụ U1: “Hãy chọn một chiếc xe đáp ứng nhu cầu của bạn, đăng ký tại địa phương bạn chọn và nói cho tôi biết cần trả khoản gì ban đầu, khoản gì định kỳ.” Không chỉ đường trừ khi người tham gia bế tắc; nếu giúp, ghi “Có trợ giúp”.

Tác vụ U2: “Hãy tìm câu trả lời cho một băn khoăn về cấu hình bằng AI, sau đó thay đổi một lựa chọn và kiểm tra giá mới.” Quan sát người dùng có nhận biết lựa chọn nào đã thay đổi không.

Tác vụ U3: “Nếu muốn đại lý tư vấn, hãy gửi yêu cầu với dữ liệu test được cung cấp. Hãy giải thích ai sẽ liên hệ và PDF này có ý nghĩa gì.” Không dùng số điện thoại thật nếu không cần.

Sale S1: “Mở yêu cầu thuộc đại lý của anh/chị, kiểm tra cấu hình và xử lý báo giá.” Sau đó hỏi thiếu thông tin nào để tư vấn. Đo từ lúc mở tác vụ đến khi xử lý xong, kể cả kiểm tra và sửa.

Sau mỗi tác vụ: hỏi mức dễ/khó 1–5, điều làm họ ngập ngừng và điều họ nghĩ hệ thống vừa thực hiện. Không lấy điểm hài lòng thay độ đúng.

## 7. Báo cáo và quyết định

Mẫu đoạn kết quả sau khi thực hiện:

“Ngày [ngày], trên [build/môi trường], nhóm chạy [n] ca thuộc phạm vi [phạm vi]. Có [a] đạt, [b] không đạt, [c] bị chặn, [d] chưa chạy, [e] không áp dụng có lý do. Lỗi quan trọng là [mã lỗi], quyết định [sửa/giảm phạm vi/ghi giới hạn]. Với [n] người tham gia thuộc [vai trò], quan sát nổi bật là [bằng chứng]. Mẫu thuận tiện và thời gian quan sát ngắn giới hạn khả năng suy rộng.”

Chỉ thay các ô bằng dữ liệu thật. Kết quả technical test đã ghi ở tài liệu cũ có thể dẫn nguồn với ngày kiểm tra, nhưng không trộn thành UAT vừa thực hiện. Release decision trong workbook là khuyến nghị từ điều kiện nhập liệu, cần PO ghi quyết định cuối và căn cứ.
