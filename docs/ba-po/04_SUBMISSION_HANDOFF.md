# Hướng dẫn hoàn tất các phần còn phụ thuộc — BA/PO

Cập nhật 15/10/2026. AI Logs đã đủ và hợp lệ theo xác nhận của bạn. Video chờ team hoàn thiện sản phẩm. Hạn nộp BTC: 23:00 ngày 18/10/2026, giờ Việt Nam.

## 1. Yêu cầu bàn giao cho team

Bạn có thể sao chép nội dung sau vào kênh nhóm sau khi điền mốc thời gian:

> Để chốt hồ sơ và nghiệm thu BA/PO, nhờ team bàn giao một bản ứng viên vào [mốc nhóm thống nhất], gồm URL, commit/build, danh sách tính năng thực sự có trên bản đó, lỗi đã biết, tài khoản demo hạn quyền và bộ dữ liệu test. Luồng cần kiểm tra là cấu hình → giá → AI → gửi yêu cầu → sale xử lý → PDF. Với giá/ưu đãi, nhờ xác nhận nguồn, version và dữ liệu nào là demo. Các ca đổi giá, retry và kiểm tra quyền hai đại lý cần chạy ở môi trường test. Sau bàn giao tôi sẽ ghi kết quả UAT, chốt tuyên bố trên form/slides và chỉ đánh dấu sẵn sàng quay khi luồng ổn định.

Đây là mẫu nội dung, chưa được gửi cho ai. Đừng dán mật khẩu vào file công khai; dùng kênh riêng của nhóm để trao đổi thông tin truy cập.

## 2. Việc bạn có thể làm trong lúc chờ

| Việc | Thời lượng gợi ý | Cách thực hiện và đầu ra |
|---|---|---|
| Review phạm vi | 30 phút | Đọc PRD cùng team; ghi DEC01–07, xác định tính năng bỏ khỏi bài nộp |
| Phỏng vấn vấn đề | 20 phút/người | Dùng hướng dẫn discovery, ghi quan sát ẩn danh; chưa cần bản chạy |
| Xác nhận business rules | 20–30 phút | Review BR01–17 với dev/nghiệp vụ, đặc biệt pin, ưu đãi và PDF |
| Chuẩn bị UAT | 20 phút | Chọn ca thuộc phạm vi, phân công người chạy, nhờ chuẩn bị fixture |
| Review slides/form | 30 phút | Kiểm tra mọi tuyên bố và xóa số liệu chưa có bằng chứng |
| Tổng hợp nhật ký của mình | 15 phút | Ghi việc đã thực hiện, ngày, đầu ra và bài học; bổ sung lịch sử từ ghi chép thật |

Các thời lượng là gợi ý sắp việc, không ghi thành worklog thực tế nếu chưa làm.

## 3. Khi nhận bản ổn định

1. Ghi URL, build/commit và ngày giờ ở tab UAT. Chạy thử luồng chính trước, sau đó các ca P0 trong phạm vi.
2. Chụp bằng chứng mỗi lỗi quan trọng; ghi bước tái hiện, kỳ vọng, thực tế, ảnh hưởng và người xử lý.
3. Khi sửa xong, chạy lại đúng ca lỗi và các ca liên quan. Giữ kết quả cũ theo run_id.
4. Ghi quyết định nghiệm thu: sẵn sàng cho luồng nào, ca nào còn chặn và ai chấp nhận giới hạn. Một video quay thành công không thay thế các ca còn lại.
5. Cập nhật form/slides theo bản đã nghiệm thu, rồi bàn giao kịch bản quay.

## 4. Những chỗ cần bổ sung trong slides

Bản PowerPoint là bản nội dung để chỉnh sửa. Có 10 slides, bao gồm một slide bằng chứng cần hoàn thiện. Phần chưa có dữ liệu được ghi rõ thay vì điền số giả.

| Slide | Nội dung đã chuẩn bị | Bạn cần bổ sung trước nộp |
|---|---|---|
| 1 | Tên và giá trị sản phẩm | Xác nhận tên cuối và cách viết tên nhóm |
| 2 | Vấn đề người mua/sale, nhãn giả thuyết | Nếu có, thay bằng phát hiện phỏng vấn có nguồn ẩn danh |
| 3 | Hành trình MVP | Loại bước/tính năng không có trên bản live cuối |
| 4 | Vai trò AI, công cụ và người duyệt | Xác nhận đúng luồng demo cuối |
| 5 | Quy tắc giá bằng ví dụ test tổng hợp | Có thể giữ để giải thích cơ chế; không gọi là báo giá thực |
| 6 | Kiến trúc sản phẩm bằng nội dung ngắn | Dev xác nhận phù hợp build bàn giao |
| 7 | Phạm vi bằng chứng và kế hoạch UAT | Thay phần “chưa chạy” bằng số ca thật, ngày/build, lỗi còn lại; thêm ảnh UI thực |
| 8 | GTM, mô hình doanh thu giả thuyết | Thêm pilot/đối tác chỉ khi đã được xác nhận |
| 9 | Chỉ số, ROI và đóng góp BA/PO | Bổ sung kết quả thật nếu có, không trộn giả định với actuals |
| 10 | Hướng phát triển và checklist bàn giao | Điền tên/vai trò thành viên, link cuối; bỏ ghi chú nháp trước xuất bản nộp |

Không cần chờ video mới review được nội dung slides. Khi có screenshot, ưu tiên một ảnh cấu hình/bảng giá và một ảnh xử lý báo giá; phải từ đúng bản nộp và ẩn dữ liệu riêng.

## 5. Video khi đủ điều kiện

Điều kiện bắt đầu quay: team đã chốt bản, luồng chính chạy ổn định, dữ liệu demo được chuẩn bị, bản PDF đọc được và tài khoản demo hoạt động. Giữ mục tiêu 2 phút 50 giây, tối đa 3 phút theo BTC. Dùng timeline trong `docs/FINAL_SUBMISSION_PLAN.md`.

Lời dẫn có thể chuẩn bị ngay:

> P97 hỗ trợ người mua cấu hình xe VinFast và hiểu chi phí lăn bánh tham khảo trước khi liên hệ đại lý. Người dùng chọn cấu hình hoặc trao đổi với trợ lý AI. Giá đi qua công cụ tính theo quy tắc nghiệp vụ dùng chung với giao diện. Khi khách gửi yêu cầu, tư vấn viên tiếp nhận cấu hình, kiểm tra và duyệt hoặc từ chối báo giá. PDF giúp trình bày lại các khoản chi phí. Trong vai trò BA/PO, tôi đặc tả phạm vi và quy tắc, thiết kế tiêu chí nghiệm thu và đánh giá chất lượng. Bước tiếp theo của nhóm là xác minh dữ liệu với đại lý và đo giá trị trong pilot.

Đây là phần lời tổng quát, chưa phải đủ ba phút. Người quay cần ghép lời theo thao tác thực tế và điều chỉnh những tính năng chưa có trên bản cuối.

## 6. Nhật ký, kết quả và tài liệu cần nhóm xác nhận

- **Weekly logs:** đã có bản ghi tuần hiện tại trong `JOURNAL.md`, ghi rõ phần do trợ lý hỗ trợ soạn. Với tuần trước, từng người cung cấp ngày/kết quả/khó khăn thật. Không tự suy diễn đóng góp từ tên commit.
- **Testing documents:** dùng PRD, workbook và hướng dẫn kiểm tra làm test design; kết quả vẫn phải chạy thực tế. Báo cáo cũ dẫn nguồn riêng với ngày kiểm tra.
- **Architecture/README:** cần dev xác nhận lần cuối sau khi hoàn thiện để không có hai phiên bản mô tả khác nhau.
- **AI Logs:** đã hoàn thành theo xác nhận của bạn; không cần làm lại.
- **Thumbnail:** sau khi có UI cuối, chụp giao diện sạch, dùng tên P97 và một câu giá trị ngắn; xuất một ảnh, upload link xem được. Form chưa nêu kích thước bắt buộc.

## 7. Cách cập nhật nội dung bài nộp khi thiếu bằng chứng

| Chưa có | Cách viết có thể dùng |
|---|---|
| User research | “Nhóm xác định giả thuyết vấn đề và thiết kế kế hoạch kiểm chứng với người mua/tư vấn viên.” |
| Đo thời gian | “Mục tiêu pilot là giảm thời gian xử lý; nhóm sẽ đo cả thời gian kiểm tra và sửa sai.” |
| Traction/doanh thu | “Mô hình thuê bao đại lý là hướng kinh doanh cần kiểm chứng.” |
| UAT bản cuối | “Đã thiết kế bộ UAT; kết quả nghiệm thu sẽ gắn với build bàn giao.” Không dùng câu này thay kiểm tra MVP trước nộp |
| Tính năng còn phát triển | Bỏ khỏi phạm vi đã hoàn thành, đưa vào roadmap có nhãn |

## 8. Công việc của bạn kết thúc ở điều kiện nào

Bạn hoàn tất phần BA/PO khi: phạm vi/BR được nhóm review; đã ghi quyết định mở; tài liệu kiểm thử và đo lường sẵn dùng; kết quả thực tế được bổ sung hoặc giới hạn ghi đúng; form/slides khớp bản nộp; có người tiếp nhận các việc phụ thuộc. Nộp hồ sơ đầy đủ còn cần video, URL/link tài nguyên và xác nhận trạng thái từ đại diện nhóm.
