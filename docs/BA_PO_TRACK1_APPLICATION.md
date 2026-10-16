# Hồ sơ áp dụng Track 1 — AI Product Management cho P97 / AutoQuote AI

Ngày lập: 15/10/2026. Vai trò sử dụng: BA/PO của nhóm.

Cập nhật: người dùng xác nhận AI Logs của mọi thành viên đã đủ và hợp lệ. Video chờ team hoàn thiện sản phẩm. Các đầu ra BA/PO có thể dùng ngay và hướng dẫn phần còn phụ thuộc được lưu tại [bộ hồ sơ BA/PO](ba-po/README.md).

## 1. Căn cứ và cách đọc

Tài liệu áp dụng các chủ đề nhìn thấy trong ảnh khóa học: Product Discovery; Design the Experiment / Human-Centered AI Design; Product Metrics / Retention & Engagement; AI Ethics / Responsible AI / Luật AI; GTM; Growth; AI Economics / ROI / Pricing; Stakeholder / Team Health & Growth Plan; AI Adoption / Change Management. Ảnh không hiển thị Day 1 và không có nội dung bài giảng chi tiết, vì vậy đây là cách vận dụng các chủ đề, không phải bản tái hiện giáo trình.

Thông báo BTC ngày 12/10/2026 do người dùng cung cấp là căn cứ cho hồ sơ nộp: hạn 23:00 ngày 18/10/2026; video tối đa 3 phút; xét chọn từ bài nộp; Demo Day 22/10/2026; mọi thành viên phải đạt ngưỡng AI Logs trên hệ thống. Ảnh không nêu ngưỡng cụ thể hoặc thang điểm chấm. Không tự gán rubric từ tài liệu mẫu cũ thành yêu cầu BTC mới.

Phân loại bằng chứng:

- **Có trong mã nguồn:** đọc được logic triển khai; chưa đồng nghĩa đã kiểm thử trên URL công khai.
- **Được tài liệu ghi nhận:** kết quả đợt kiểm tra trước; chưa chạy lại trong lần phân tích này.
- **Giả thuyết / mục tiêu đề xuất:** phải kiểm chứng, không đưa vào mục thành tích.
- **Chưa xác minh:** thiếu minh chứng hoặc chưa truy cập được.

## 2. Chẩn đoán sản phẩm hiện tại

Định vị đề xuất cho bài nộp: **P97 — Trợ lý AI cấu hình xe và hỗ trợ báo giá VinFast**, tên trong tài liệu kỹ thuật là AutoQuote AI. Dùng một tên thống nhất trên form, video và slides; giải thích tên cũ một lần nếu cần.

Giá trị cần chứng minh: giúp người mua hiểu cấu hình và chi phí tham khảo; giúp tư vấn viên tiếp nhận yêu cầu có cấu hình rõ ràng và kiểm tra báo giá với ít thao tác hơn. Chưa có bằng chứng định lượng cho mức tiết kiệm thời gian hoặc tăng chuyển đổi.

| Nội dung | Bằng chứng trong repository | Cách trình bày đúng |
|---|---|---|
| Cấu hình xe và tính giá | `src/services/pricing.py`, giao diện configurator | Có triển khai; cần demo bản online |
| AI tư vấn và tra cứu | `src/agents/graph.py`, `src/agents/tools/` | AI sử dụng công cụ và RAG; không bảo đảm mọi câu trả lời đúng |
| Quy tắc giá dùng chung | Pricing service, API báo giá và công cụ AI | Tính toán theo quy tắc lập trình, phụ thuộc chất lượng dữ liệu đầu vào |
| Khuyến mãi | Pricing service | Chọn một ưu đãi hợp lệ có giá trị lớn nhất; không tự cộng dồn; ưu đãi có điều kiện không tự áp dụng |
| Lead, báo giá, duyệt | `src/api/business_routes.py` | Có tạo yêu cầu, lưu giá tại thời điểm tạo và duyệt theo quyền |
| PDF | API PDF, trang báo giá | Có PDF tham khảo và PDF từ bản đã lưu; chưa có điều kiện bắt buộc đã duyệt mới được tải |
| Lịch sử chat | `src/api/routes.py` | API lưu/đọc hội thoại trong DB; đoạn README nói chỉ lưu bộ nhớ đã lạc hậu |
| Cập nhật danh sách | `docs/FEATURE_REVIEW.md` | Polling định kỳ, không gọi là push thời gian thực |
| Marketplace nhiều đại lý | `docs/PRODUCT_ONE_PAGE.md` | Định hướng rộng hơn hiện trạng; không tuyên bố luồng đấu nhận lead liên đại lý hoàn chỉnh |
| Zalo | Trang seller/leads | Thấy nút sale mở Zalo của khách; chưa đủ chứng minh khách được tự động ghép sale như one-pager |
| Kiểm thử | `docs/SUPABASE_SWITCH.md` | Tài liệu ghi 146 test hồi quy đạt; cần báo cáo/lần chạy gắn commit để dùng làm bằng chứng nộp |
| Traction | `eval/results/report.md` còn mẫu | Chưa có kết quả người dùng; số tài khoản/lead trong DB không chứng minh người dùng thật |

Điểm lệch tài liệu phát hiện và trạng thái cập nhật ngày 15/10:

1. One-pager đã thêm ghi chú định hướng ban đầu; PRD mới tách MVP/roadmap để review.
2. `docs/architecture_diagram.md` đã cập nhật PostgreSQL/pgvector, công cụ giá và luồng PDF; dev cần xác nhận theo build cuối.
3. Đã sửa đoạn README cũ về thiếu xác thực/checkpoint bộ nhớ để khớp API lưu lịch sử/phiên DB.
4. Đã cập nhật presentation/checklist từ 5 phút thành 3 phút theo BTC.
5. AI Logs khóa học là điều kiện theo từng thành viên trên hệ thống BTC; không mặc nhiên đồng nhất với log gọi LLM trong ứng dụng.

## 3. Product Discovery — xác định vấn đề có thật

**Người dùng và người trả tiền là hai nhóm khác nhau.** Người mua sử dụng công cụ để hiểu xe/chi phí; sale dùng để xử lý yêu cầu; quản lý đại lý là người có thể quyết định trả phí. Mô hình thuê bao đại lý mới là giả thuyết kinh doanh.

Jobs-to-be-Done đề xuất:

- Người mua: Khi cân nhắc một cấu hình xe và nơi đăng ký, tôi muốn biết các khoản chi phí và điều kiện ưu đãi để quyết định có nên liên hệ đại lý.
- Sale: Khi nhận yêu cầu tư vấn, tôi muốn thấy cấu hình và giá tham khảo đã tính để kiểm tra và phản hồi mà không hỏi lại toàn bộ.
- Quản lý: Khi đánh giá công cụ, tôi muốn biết thời gian xử lý và chất lượng lead có cải thiện đủ để bù chi phí vận hành hay không.

Kế hoạch discovery gọn trước hạn nộp: mời 3–5 người đang tìm hiểu mua xe và 2–3 tư vấn viên nếu nhóm tiếp cận được. Đây là nghiên cứu định tính thuận tiện, không đại diện thị trường. Nếu chỉ có bạn học đóng vai, ghi rõ là usability test với người đóng vai, không gọi là xác thực nhu cầu thị trường.

Câu hỏi phỏng vấn:

1. Lần gần nhất anh/chị tìm giá hoặc lập báo giá xe là khi nào? Hãy kể từng bước.
2. Đã dùng nguồn/công cụ nào? Chỗ nào phải hỏi lại hoặc làm lại?
3. Có thể cho xem một ví dụ đã ẩn thông tin cá nhân không?
4. Khoản phí hay điều kiện ưu đãi nào dễ hiểu nhầm nhất?
5. Điều gì khiến anh/chị tin hoặc không tin một báo giá?
6. Với sale/quản lý: ai xác nhận chính sách, ai phê duyệt mua phần mềm, ngân sách lấy từ đâu?

Tránh câu dẫn dắt như “Anh/chị có thích AI giúp tiết kiệm thời gian không?”. Đo thao tác và tình huống gần nhất trước khi giới thiệu sản phẩm.

Mẫu ghi nhận: `participant_id | nhóm người dùng | tình huống thật | bước hiện tại | khó khăn | bằng chứng ẩn danh | cách đang giải quyết | mức ảnh hưởng | giả thuyết bị bác bỏ/xác nhận`.

**Đầu ra BA/PO:** problem statement một trang, bản đồ hành trình hiện tại, danh sách giả thuyết và evidence log. Con số 15–20 phút trong one-pager phải coi là giả định cho đến khi có quan sát.

## 4. Human-Centered AI Design và thiết kế thí nghiệm

Luồng giá trị cốt lõi: chọn cấu hình → xem chi phí → hỏi AI về điểm chưa rõ → gửi yêu cầu đến đại lý → sale kiểm tra/duyệt → xuất và giải thích báo giá. PDF tham khảo có thể xuất trước bước duyệt; cần nhãn rõ để tránh hiểu nhầm.

Phân vai:

- Người mua chọn hoặc sửa cấu hình, quyết định có cung cấp thông tin liên hệ.
- AI diễn giải câu hỏi, gọi công cụ, hỏi lại khi thiếu dữ liệu và trình bày kết quả.
- Công cụ nghiệp vụ kiểm tra dữ liệu, tính giá, xác định ưu đãi phù hợp.
- Sale xác minh điều kiện thương mại và xử lý yêu cầu; PO không thay sale xác nhận giá thực tế.

| Thí nghiệm đề xuất | Cách thực hiện | Đo lường / điều kiện quyết định |
|---|---|---|
| E1: Có AI giúp hoàn thành tác vụ tốt hơn không? | Cùng người thực hiện 2 tác vụ tương đương: configurator không chat và configurator có chat; đảo thứ tự giữa người tham gia | Thời gian, hoàn thành không trợ giúp, lỗi cấu hình; mục tiêu thăm dò giảm trung vị thời gian ≥20% mà không tăng lỗi |
| E2: Sale xử lý nhanh hơn không? | Sale xử lý các tình huống tương đương theo cách hiện tại và qua P97; đo cả kiểm tra/sửa sai | Thời gian trung vị giảm ≥30% là mục tiêu đề xuất; không dùng ước lượng thay kết quả |
| E3: Khách có hiểu giới hạn báo giá? | Cho xem PDF/giao diện, yêu cầu giải thích tổng tiền, khoản định kỳ và điều kiện chưa xác nhận | Mục tiêu ≥4/5 người trả lời đúng các điểm chính; nếu sai, ưu tiên sửa cách diễn đạt |
| E4: AI xử lý thiếu dữ liệu và yêu cầu sai thế nào? | Bộ 30–50 tình huống gồm giá, thiếu tỉnh, ưu đãi hết hạn/có điều kiện, nội thất không có nguồn, tool lỗi, yêu cầu cộng dồn | Đối chiếu từng câu với nguồn; mọi lỗi tiền quan trọng hoặc tự xác nhận ưu đãi là lỗi chặn demo tình huống đó |

Mẫu kết quả: `case_id | phiên bản/commit | nguồn chuẩn | thao tác | kết quả kỳ vọng | thực tế | thời gian | lỗi | bằng chứng | người chấm`.

Mẫu nhỏ chỉ giúp tìm vấn đề và đưa ra quyết định bước tiếp theo; không chứng minh uplift thị trường. Không cần chạy A/B production trong ba ngày còn lại.

## 5. Product Metrics — đo giá trị thay vì đếm tin nhắn

North Star đề xuất cho pilot: **số yêu cầu báo giá đủ thông tin, được sale xác nhận đủ điều kiện tiếp tục tư vấn trong tuần**. Cần rubric gồm cấu hình xác định, liên hệ dùng được, khách chủ động yêu cầu và không trùng. Trạng thái `approved` riêng lẻ chưa đo đủ định nghĩa này.

| Chỉ số | Định nghĩa / mẫu số | Nguồn và giới hạn |
|---|---|---|
| Activation người mua | Phiên có cấu hình hợp lệ và tính giá thành công / phiên bắt đầu configurator | Cần sự kiện analytics; loại nội bộ/bot theo quy tắc thống nhất |
| Conversion yêu cầu | Phiên gửi yêu cầu thành công / phiên tính giá thành công trong cùng kỳ | Đếm phiên duy nhất, không đếm retry thành nhiều chuyển đổi |
| Thời gian đến giá đầu tiên | Từ bắt đầu cấu hình đến nhận kết quả giá hợp lệ đầu tiên | Trung vị và p90; chưa có số đo |
| Thời gian xử lý sale | Từ yêu cầu thành công đến hành động xử lý đầu tiên | Tách giờ làm việc; cần timestamp hành động |
| Độ chính xác tính giá | Ca khớp kết quả chuẩn / tổng ca kiểm thử giá | 100% bộ ca là ngưỡng kiểm thử, không là cam kết 100% mọi tình huống |
| AI grounded answer rate | Câu có mọi khẳng định quan trọng được nguồn hỗ trợ / câu được đánh giá | Người chấm xác minh; tách từ chối đúng và trả lời đầy đủ |
| Chi phí mỗi yêu cầu hợp lệ | Chi phí AI biến đổi / số yêu cầu hợp lệ cùng kỳ | Gồm lượt chat bỏ dở và retry; không chỉ chat dẫn đến chuyển đổi |
| Sale retention tuần 2 | Sale có xử lý nghiệp vụ tuần 2 / sale đã kích hoạt tuần 1 có đủ thời gian quan sát | Hành động có giá trị, không chỉ đăng nhập |
| Dealer retention tháng | Đại lý tiếp tục hoạt động/trả phí / cohort đủ tuổi | Chỉ đo khi pilot đủ dài; hiện chưa có |

Mua xe là hành vi không thường xuyên: không lấy D1/D7 retention người mua như tiêu chí trung tâm. Có thể đo quay lại cấu hình trong chu kỳ cân nhắc, nhưng phải giải thích cửa sổ quan sát.

Đặc tả sự kiện đề xuất cho đội dev, **chưa xác nhận đã triển khai**: `configurator_started`, `pricing_succeeded`, `pricing_failed`, `chat_answered`, `chat_fallback`, `quote_requested`, `quote_reviewed`, `pdf_downloaded`. Gắn event_id, thời gian, môi trường, phiên ẩn danh, model xe, quote_id nếu phù hợp, phiên bản sản phẩm và mã lỗi. Không đẩy điện thoại hoặc toàn văn hội thoại vào analytics phổ thông. Sự kiện gửi/duyệt cần lấy thành công từ server. Không gọi tải PDF là bán xe.

## 6. Responsible AI — chuyển nguyên tắc thành tiêu chí nghiệm thu

| Rủi ro | Kiểm soát đã thấy | Việc BA/PO cần đặc tả / xác minh |
|---|---|---|
| AI bịa giá | Tool cấu trúc, hướng dẫn và guard số tiền | Bộ ca chuẩn, nguồn dữ liệu và thời điểm hiệu lực; guard không bảo đảm đúng ngữ cảnh |
| Dữ liệu cũ nhưng tính toán đúng | Có price_version và mốc hiệu lực | Chủ sở hữu dữ liệu ký xác nhận; tách dữ liệu demo khỏi chính sách thương mại |
| Hiểu nhầm PDF là cam kết | Giao diện có nhãn giá tham khảo, API có duyệt | Kiểm tra nhãn trên từng trạng thái/PDF; quyết định quy tắc phát hành chính thức |
| Tự hưởng ưu đãi có điều kiện | Công cụ không tự áp dụng khi có điều kiện | Xác định ai xác minh điều kiện và bằng chứng cần lưu |
| Chia sẻ dữ liệu khách ngoài ý muốn | Có phân quyền đại lý, thông báo liên hệ; newsletter có checkbox riêng | Rà luồng dữ liệu, mục đích xử lý, thời hạn lưu, xóa/yêu cầu hỗ trợ và dữ liệu gửi nhà cung cấp AI |
| Tư vấn thiên lệch | Sản phẩm tập trung VinFast | Nói rõ phạm vi catalog; không gọi là so sánh toàn thị trường hoặc “rẻ nhất” khi chưa chứng minh |
| AI lỗi/không đủ nguồn | Có fallback và hỏi lại | Người dùng hiểu bước tiếp theo; thử tình huống mất AI nhưng cấu hình thủ công vẫn dùng được |

Phần “Luật AI” của track nên thể hiện bằng **danh mục câu hỏi rà soát pháp lý và phân công người kiểm tra**, không tự tuyên bố sản phẩm đã tuân thủ. Tài liệu này không đối chiếu luật hiện hành và không đưa kết luận pháp lý. Trước dùng dữ liệu khách thật, cần xác định các yêu cầu áp dụng với dữ liệu cá nhân, công khai thông tin AI, nội dung quảng cáo/báo giá và nhà cung cấp xử lý dữ liệu.

## 7. GTM và Growth — kiểm chứng phân khúc nhỏ trước

Beachhead đề xuất: một đại lý hoặc nhóm sale sẵn sàng tham gia pilot, một khu vực đăng ký và các dòng xe có dữ liệu được xác minh. Chọn dựa trên khả năng tiếp cận của nhóm, chưa phải kết quả nghiên cứu thị trường.

Thông điệp người mua: “Tự cấu hình xe, hiểu từng khoản chi phí tham khảo và chủ động gửi yêu cầu tư vấn.” Thông điệp đại lý: “Tiếp nhận yêu cầu kèm cấu hình rõ ràng và kiểm tra báo giá trên cùng dữ liệu.”

GTM pilot: BA/PO tuyển người tham gia và thống nhất vấn đề → sale champion hướng dẫn dùng → chạy tác vụ thật có kiểm soát → review hàng tuần → hỏi mức sẵn sàng trả phí bằng đề nghị pilot cụ thể. Không suy ra willingness-to-pay từ việc người dùng nói “hay”.

Growth loop giả thuyết: đại lý duy trì dữ liệu tốt → khách hiểu báo giá hơn → yêu cầu có chất lượng hơn → sale xử lý hữu ích → đại lý tiếp tục sử dụng và giới thiệu. Mỗi mũi tên cần kiểm chứng, chưa phải vòng tăng trưởng đã xảy ra.

Ưu tiên thử nghiệm giảm rớt tại bước gửi yêu cầu, làm rõ nhãn giá và giảm câu hỏi phải nhập lại. Đo chất lượng lead cùng conversion để tránh tăng lead rác. Chưa ưu tiên mở marketplace, quảng cáo trả phí hoặc tính năng lan truyền trước khi luồng cốt lõi ổn định.

## 8. AI Economics / ROI / Pricing

Mô hình đề xuất để kiểm chứng: thuê bao theo đại lý, có hạn mức sử dụng AI; chưa chốt mức giá hoặc khẳng định đã có doanh thu. Cần phỏng vấn người có quyền mua và đo chi phí thực.

Công thức:

- Chi phí AI = token đầu vào × đơn giá + token đầu ra × đơn giá + embedding + công cụ trả phí; lấy giá thực từ nhà cung cấp tại thời điểm đo.
- Lợi ích năng lực xử lý/tháng = số báo giá × số phút tiết kiệm mỗi báo giá / 60 × chi phí lao động theo giờ.
- ROI khách hàng = (lợi ích quy đổi − tổng chi phí áp dụng) / tổng chi phí áp dụng. Thời gian tiết kiệm là năng lực được giải phóng, không tự động là tiền mặt tiết kiệm.
- Lãi đóng góp mỗi đại lý = doanh thu thuê bao − chi phí biến đổi AI/hạ tầng/hỗ trợ cho đại lý đó.
- Số đại lý hòa vốn vận hành = chi phí cố định / lãi đóng góp mỗi đại lý, chỉ có nghĩa khi lãi đóng góp dương.

Ví dụ **giả định minh họa, không phải kết quả dự án**: 100 báo giá/tháng, giảm từ 15 xuống 7 phút, chi phí lao động quy đổi 60.000đ/giờ → năng lực tiết kiệm tương đương 800.000đ/tháng. Nếu toàn bộ chi phí áp dụng là 500.000đ/tháng thì ROI quy đổi là 60%. Không dùng ví dụ này để chốt giá bán; thay từng đầu vào bằng số pilot. Không cộng doanh thu từ giá trị báo giá đã duyệt.

## 9. Stakeholder, Team Health và Change Management

| Quyết định / đầu ra | Người chịu trách nhiệm chính đề xuất | Người phối hợp |
|---|---|---|
| Phạm vi, ưu tiên, nghiệm thu và bài nộp | Bạn — BA/PO | Cả nhóm |
| Công thức, nguồn giá và điều kiện ưu đãi | Đại diện nghiệp vụ/sale | BA/PO, backend |
| Chất lượng AI và bộ đánh giá | Thành viên AI/backend | BA/PO, QA |
| Tính khả dụng bản live | Thành viên phụ trách triển khai | Frontend, backend, QA |
| Video, slide, thumbnail | Người làm nội dung được nhóm phân công | BA/PO duyệt câu chuyện và bằng chứng |
| AI Logs trên hệ thống BTC | Từng thành viên | BA/PO theo dõi trạng thái |

Đây là phân công theo vai trò; nhóm cần điền tên, không mặc định đã có đủ nhân sự riêng biệt.

Team health trước hạn: họp 15 phút/ngày với ba câu: việc nào chặn bài nộp, ai quyết định, thời điểm xử lý. BA/PO giữ một backlog và decision log; chốt phạm vi, tránh thay luồng demo sát giờ. Theo dõi tải công việc và người dự phòng cho deploy/nộp bài.

Adoption pilot: giải thích lợi ích cho sale → chọn một champion → hướng dẫn ngắn bằng tình huống thật → xử lý vài ca có hỗ trợ → thu phản hồi → review lỗi và công nhận cải tiến. Đo tỷ lệ sale có tác vụ đầu tiên, tỷ lệ dùng lại và lý do bỏ dùng. Quy định rõ ai cập nhật giá, ai nhận lỗi và ai có quyền tạm ngừng tư vấn khi nguồn không đáng tin.

## 10. Backlog BA/PO và tiêu chí nghiệm thu

P0 = chặn hồ sơ hợp lệ hoặc luồng demo; P1 = tăng độ tin cậy; P2 = sau checkpoint. Không gán điểm RICE khi chưa có dữ liệu Reach/Impact/Confidence.

| Ưu tiên | Công việc | Tiêu chí hoàn thành |
|---|---|---|
| P0 | Chốt tên và phạm vi MVP | Form, slide, video mô tả cùng một luồng; roadmap được gắn nhãn |
| P0 | Kiểm tra live từ trình duyệt mới | Cấu hình, chat, gửi yêu cầu, sale xử lý, PDF chạy được; có bằng chứng gắn bản deploy |
| Hoàn thành | AI Logs của mọi thành viên | Đã đủ và hợp lệ theo xác nhận người dùng ngày 15/10/2026 |
| P0 | Hoàn thành video ≤180 giây và link tài liệu | Mở được ở chế độ không đăng nhập; người khác kiểm tra lại |
| P0 | Sửa tài liệu mâu thuẫn | Kiến trúc, README, thời lượng video và phạm vi khớp mã nguồn đã nộp |
| P1 | UAT và AI eval có kết quả thật | Ghi từng ca pass/fail, lỗi còn lại, người kiểm tra, ngày và commit |
| P1 | Thu phản hồi người dùng | Có ghi chép ẩn danh, phương pháp tuyển, giới hạn mẫu và quyết định từ phản hồi |
| P2 | Theo dõi funnel và chi phí đầy đủ | Event spec, định nghĩa cohort, dashboard kiểm tra được |
| P2 | Pilot thương mại/marketplace | Có đối tác và bằng chứng nhu cầu trước khi mở rộng |

Các acceptance criteria BA/PO nên sở hữu:

1. **AC-PRICE:** Với cấu hình hợp lệ và bộ dữ liệu chuẩn, API, bảng giá và PDF khớp từng khoản; khi nguồn giá thiếu hoặc xung đột, không phát hành kết quả như giá đã xác nhận.
2. **AC-PROMO:** Với ưu đãi hết hạn, sai đại lý hoặc còn điều kiện, hệ thống không tự áp dụng; không cộng dồn khi chưa có quy tắc cho phép.
3. **AC-CHANGE:** Khi giá thay đổi giữa lúc xem và gửi, người dùng được báo để xem lại; snapshot cũ vẫn giữ giá lịch sử.
4. **AC-RETRY:** Gửi lại cùng request_id và nội dung không tạo thêm lead/báo giá.
5. **AC-REVIEW:** Người ngoài phạm vi đại lý không duyệt/tải báo giá của đại lý khác; duyệt không biến thành giao dịch bán xe thành công.
6. **AC-PDF:** Người xem phân biệt được bản tham khảo và tình trạng xử lý; nếu muốn khóa xuất bản chính thức trước duyệt, đó là yêu cầu bổ sung cần triển khai và kiểm thử.
7. **AC-AI:** Thiếu tỉnh/cấu hình phải hỏi lại; thiếu nguồn phải nói rõ; lời tư vấn không tự xác nhận ưu đãi hoặc lãi suất.

## 11. Đóng góp cá nhân BA/PO có thể chứng minh

Hồ sơ nên nối thành chuỗi: **phát hiện vấn đề → quyết định sản phẩm → yêu cầu/tiêu chí → bằng chứng kiểm thử → điều chỉnh ưu tiên**.

Lưu các đầu ra bạn thực sự thực hiện: biên bản phỏng vấn; problem statement; phân định MVP/roadmap; user stories và acceptance criteria; bộ UAT/AI eval; metric dictionary; risk register; decision log; kế hoạch pilot; nội dung form và kịch bản demo. Không nhận là đã phỏng vấn, đo ROI hoặc chạy pilot nếu mới có kế hoạch.

Câu giới thiệu vai trò có thể dùng sau khi đã thực hiện: “Tôi phụ trách BA/PO: làm rõ vấn đề người mua và tư vấn viên, chuyển nhu cầu thành phạm vi và tiêu chí nghiệm thu, xác định điểm cần con người xác nhận, thiết kế đánh giá chất lượng và chuẩn hóa bằng chứng cho bài nộp.”

## 12. Nguồn nội bộ đã đọc

- `README.md`, `docs/PRODUCT_ONE_PAGE.md`, `docs/FEATURE_REVIEW.md`.
- `docs/SUPABASE_SWITCH.md`, `docs/architecture_diagram.md`.
- `src/services/pricing.py`, `src/agents/graph.py`, `src/api/routes.py`, `src/api/business_routes.py`.
- Các trang/thành phần configurator, quote, seller/leads, thông báo đồng ý liên hệ và newsletter.
- `presentation/README.md`, `docs/guide/deliverables/checklist.md`, `eval/results/report.md`.

Lần phân tích này không sửa mã sản phẩm, không chạy lại bộ test, không kiểm tra dữ liệu khách hàng và chưa xác minh luồng live. Công cụ web không truy cập được URL trong ảnh; điều đó không đủ kết luận website bị sập.
