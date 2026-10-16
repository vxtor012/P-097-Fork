# Kế hoạch sản phẩm, đo lường và pilot — P97

Ngày 15/10/2026. Các phương án trong tài liệu là đề xuất BA/PO để nhóm review, chưa phải cam kết với đại lý hoặc kết quả đã đạt.

## 1. Giả thuyết cần kiểm chứng

| Mã | Giả thuyết | Kiểm chứng | Quyết định sau khi có dữ liệu |
|---|---|---|---|
| H01 | Khách khó hiểu chi phí và ưu đãi khi cấu hình xe | Phỏng vấn lần gần nhất, ví dụ cụ thể | Chọn đúng vấn đề hoặc sửa problem statement |
| H02 | P97 giúp hoàn thành cấu hình với ít lỗi hơn | Usability cùng tác vụ và dữ liệu chuẩn | Ưu tiên lỗi cản trở thay tính năng thêm |
| H03 | Sale xử lý yêu cầu nhanh hơn và ít hỏi lại hơn | So sánh tác vụ tương đương, đo cả sửa sai | Giữ/sửa nội dung hồ sơ lead |
| H04 | AI giúp hơn configurator thuần | Tác vụ tương đương có/không AI, đảo thứ tự | Xác định tác vụ nào nên có AI |
| H05 | Quản lý đại lý sẵn sàng trả phí | Đề nghị pilot cụ thể với người có quyền mua | Kiểm tra mô hình thuê bao và khả năng trả phí |

Các ngưỡng giảm 20%/30% trong hồ sơ Track 1 chỉ là mục tiêu thăm dò. Chốt trước phép thử, không sửa ngưỡng sau khi xem kết quả để tuyên bố thành công.

## 2. Metric dictionary

North Star pilot: số yêu cầu duy nhất trong tuần được sale xác nhận đủ điều kiện tiếp tục tư vấn. Yêu cầu hợp lệ phải có cấu hình xác định, liên hệ dùng được, ý định liên hệ chủ động và không trùng. Cần rubric/manual review riêng; `approved` không thay cho bốn điều kiện này.

| ID | Chỉ số và công thức | Cửa sổ / cách thu | Tránh hiểu sai |
|---|---|---|---|
| M01 | Activation = phiên có giá thành công / phiên bắt đầu configurator | Phiên ẩn danh, cùng tuần; chưa có tracking thì ghi thủ công trong usability | Không dùng pageview làm người dùng |
| M02 | Quote conversion = phiên gửi yêu cầu thành công / phiên có giá thành công | Cùng tuần, mỗi phiên tính một lần; tách demo/nội bộ | Retry không phải lead mới |
| M03 | Tỷ lệ yêu cầu hợp lệ = yêu cầu đạt rubric / yêu cầu gửi thành công | Cùng tuần theo quote/request ID; sale đánh giá | Approved không mặc nhiên là lead tốt |
| M04 | Thời gian xử lý sale | Trung vị, p90 từ tạo yêu cầu tới hành động nghiệp vụ đầu tiên; tách giờ làm | Polling hoặc đăng nhập không phải phản hồi |
| M05 | Task success = lượt hoàn thành đúng không trợ giúp / lượt thử | Theo từng tác vụ U1/U2/U3/S1; ghi vai trò người tham gia | Tách có trợ giúp và bỏ cuộc |
| M06 | Pricing correctness = ca giá khớp chuẩn / ca giá đã chạy | Theo commit và fixture, báo số chưa chạy/bị chặn | 100% bộ ca không là 100% mọi cấu hình |
| M07 | AI grounded rate = lần trả lời có toàn bộ khẳng định quan trọng được nguồn hỗ trợ / lần trả lời đã chấm | Theo case/model/commit, chấm từng lần chạy | Tách trả lời đúng, từ chối đúng và thiếu thông tin |
| M08 | AI cost / valid request = toàn bộ chi phí AI kỳ đo / yêu cầu hợp lệ cùng kỳ | Gồm chat không chuyển đổi, retry, embedding và công cụ tính phí | Chưa có denominator thì để chưa đủ dữ liệu |
| M09 | Sale W2 retention = sale kích hoạt W1 có tác vụ W2 / sale kích hoạt W1 đã đủ tuổi quan sát | Cohort tuần kích hoạt, hành động nghiệp vụ | Không đủ hai tuần thì chưa đo được |
| M10 | Dealer monthly retention | Đại lý tiếp tục dùng/trả phí / cohort đại lý đủ tuổi | Cần ít nhất một chu kỳ; tách trả phí khỏi dùng thử | Không công bố trước khi có pilot |

Các tỷ lệ không có mẫu số phải hiện “Chưa đủ dữ liệu”, không hiện 0%. Mua xe là hành vi không thường xuyên nên retention người mua không làm tiêu chí chính của checkpoint.

## 3. Đặc tả sự kiện để trao đổi với dev

Đây là event spec đề xuất, chưa tuyên bố analytics đã triển khai. Nếu không kịp, dùng quan sát thủ công với mã phiên thử để thu M05–M07.

| Sự kiện | Thời điểm ghi thành công | Trường riêng hữu ích |
|---|---|---|
| configurator_started | Phiên mở và dùng configurator lần đầu | entry_source |
| pricing_succeeded / pricing_failed | Server trả kết quả hợp lệ / lỗi | model, province, price_version, error_code |
| chat_answered / chat_fallback | Trả lời cuối / thông báo giới hạn | request_id, model_id, latency_ms, token usage nếu có |
| quote_requested | Server đã lưu giao dịch thành công | quote_id, request_id, dealer_id |
| quote_reviewed | Server lưu hành động duyệt/từ chối | quote_id, action, reviewer role |
| pdf_downloaded | Tải file thành công theo định nghĩa thống nhất | quote_id nếu có, type preview/saved, status |

Trường chung: event_id duy nhất, occurred_at theo UTC, environment, build_id, session_id ẩn danh, is_internal_test. Nếu nhận event lặp, loại theo event_id. Không gửi điện thoại, họ tên hoặc toàn văn chat vào analytics thông thường. Không suy ra bán xe từ tải PDF/duyệt báo giá.

## 4. GTM và growth

Phân khúc pilot đề xuất: một đại lý/nhóm sale có thể tiếp cận, một địa phương và các dòng xe đã xác minh dữ liệu. Đối tượng sử dụng là người mua và sale. Người quyết định trả phí có thể là quản lý/chủ đại lý; phải phỏng vấn để xác nhận.

Thông điệp: với khách, “Tự cấu hình và hiểu chi phí tham khảo trước khi liên hệ”. Với sale, “Tiếp nhận yêu cầu kèm cấu hình và kiểm tra giá trên cùng dữ liệu”. Tránh “rẻ nhất”, “chính xác tuyệt đối” hoặc “tăng doanh thu” khi chưa có bằng chứng.

Pilot đề xuất hai tuần sau khi bản ổn định và có đối tác đồng ý, không ràng buộc ngày 18/10:

1. Onboard một champion, thống nhất nguồn dữ liệu và các tình huống dùng thử.
2. Hướng dẫn 15 phút, thực hiện một yêu cầu có kiểm soát, xác định người hỗ trợ.
3. Theo dõi tác vụ, lỗi, thời gian và số yêu cầu đạt rubric; review ngắn hai lần/tuần.
4. Cuối pilot, review giá trị với người quyết định mua, đề nghị bước tiếp theo có điều kiện và chi phí cụ thể.

Growth hypothesis: dữ liệu đáng tin làm khách hiểu hơn, yêu cầu tốt hơn giúp sale phục vụ tốt hơn, từ đó đại lý có lý do tiếp tục dùng/giới thiệu. Đo từng liên kết. Chỉ thử tăng traffic sau khi luồng và chất lượng lead ổn định.

## 5. AI Economics, ROI và pricing

Workbook có phần nhập số thực tế để tính lợi ích thời gian, chi phí AI trên yêu cầu hợp lệ và ROI quy đổi. Không điền sẵn số giả làm actuals. Đơn giá nhà cung cấp lấy từ hóa đơn hoặc bảng giá đúng ngày đo; không dùng mức giá được nhớ từ trước.

- Lợi ích thời gian/tháng = số báo giá × (phút cách cũ − phút P97) / 60 × chi phí lao động/giờ. Phút P97 gồm cả kiểm tra và sửa sai.
- Chi phí áp dụng/tháng = thuê bao + đào tạo phân bổ + hỗ trợ/vận hành phát sinh.
- ROI quy đổi = (lợi ích thời gian − chi phí áp dụng) / chi phí áp dụng. Đây là năng lực lao động quy đổi, chưa chắc tiết kiệm tiền mặt.
- AI cost/valid request = tổng chi phí AI kỳ đo / số yêu cầu hợp lệ cùng kỳ. Ghi thêm kỳ và tiền tệ để không trộn nguồn.
- Mô hình doanh thu giả thuyết: thuê bao đại lý có hạn mức AI, chi phí vượt mức chỉ đề xuất sau khi đo. Chưa chốt giá và chưa có doanh thu xác minh.

Trước định giá cần thu: lượng báo giá, tần suất dùng, người mua phần mềm, công cụ thay thế, chi phí hỗ trợ/AI, ngân sách và phản ứng với một đề nghị cụ thể. Không dùng giá trị báo giá đã duyệt làm doanh thu.

## 6. Responsible AI và quản trị rủi ro

| Rủi ro | Người đề xuất xử lý | Hành động và bằng chứng |
|---|---|---|
| R01 Giá/phí/ưu đãi không còn đúng | Nghiệp vụ + BA | Ghi nguồn, ngày hiệu lực, người xác nhận; ca biên và lỗi dữ liệu |
| R02 AI nêu số sai hoặc sai ngữ cảnh | AI/backend + QA | Bộ AI eval, trace tool nếu có, ảnh câu trả lời; PO ưu tiên lỗi tiền |
| R03 Khách hiểu PDF là cam kết | BA/PO + frontend | Quyết định DEC03, kiểm tra hiểu trong UAT và PDF mẫu |
| R04 Dữ liệu khách tới sai đại lý | Backend + QA | Ca quyền hai đại lý, evidence ẩn dữ liệu riêng, lỗi chặn release |
| R05 Khách không hiểu mục đích liên hệ | BA/PO | Review thông báo trước gửi; hỏi lại trong usability |
| R06 Bản live khác mã nghiệm thu | Deploy + PO | Commit/build/date, smoke test và links cuối |
| R07 Team đổi luồng sát lúc quay | PO + nhóm | Chốt phạm vi, change log và thời điểm bàn giao |

Phần vận dụng “Luật AI” dừng ở checklist câu hỏi cần người phụ trách rà soát: mục đích thu thập dữ liệu, bên nhận/xử lý, quyền truy cập, thời hạn lưu/xóa, nội dung công khai về AI và báo giá. Chưa có đối chiếu luật cụ thể hoặc kết luận tuân thủ trong hồ sơ này.

## 7. Stakeholder, team health và adoption

| Đầu ra | Người chịu trách nhiệm đề xuất | Ai xác nhận |
|---|---|---|
| Phạm vi, US/BR/AC và ưu tiên | Bạn — BA/PO | Nhóm review, PO ghi quyết định |
| Nguồn/chính sách giá | Đại diện nghiệp vụ do nhóm chỉ định | Người có thẩm quyền nghiệp vụ |
| Bản build, tài khoản test, dữ liệu test | Dev/deploy | QA/dev báo sẵn sàng, BA nhận bàn giao |
| Kết quả UAT và đánh giá AI | BA/PO phối hợp QA/dev | PO quyết định theo bằng chứng |
| Nội dung slides/form | BA/PO | Nhóm review tính đúng của tuyên bố |
| Video thực tế | Người nhóm phân công sau bàn giao | BA/PO đối chiếu kịch bản và thời lượng |
| Nộp bài | Đại diện nhóm được xác nhận | Lưu trạng thái hệ thống |

Nhóm cần điền tên thực tế trong workbook, không tạo thêm vai trò nhân sự bắt buộc. Họp 15 phút mỗi ngày: phần nào chặn bàn giao, ai xử lý, mốc nào cập nhật. Dùng một danh sách ưu tiên chung, ghi quyết định thay vì để mâu thuẫn trong chat. Theo dõi ai đang quá tải và có người dự phòng cho deploy/nộp bài.

Adoption với sale: chọn champion, giải thích lợi ích đúng công việc, hướng dẫn bằng một tình huống, thực hành có hỗ trợ, hỏi lý do bỏ dùng, chỉnh quy trình. Đo hành động nghiệp vụ đầu tiên và sử dụng lại thay đăng nhập. Bàn giao chủ sở hữu dữ liệu và kênh báo lỗi để công cụ không phụ thuộc duy nhất người viết code.
