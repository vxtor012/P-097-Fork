# Hồ sơ nộp dự án P97 — theo thông báo BTC ngày 12/10/2026

Ngày chuẩn bị: 15/10/2026. Hạn BTC: **23:00 ngày 18/10/2026**. Lịch dưới đây dùng giờ Việt Nam (UTC+7). Demo Day: 22/10/2026.

BGK xét chọn dự án từ hồ sơ, không pitching lần lượt từng nhóm ở vòng này. Vì vậy mô tả, MVP, video và slides phải tự giải thích được bài toán, giải pháp, tính khả thi và định hướng phát triển.

**Cập nhật theo xác nhận của BA/PO ngày 15/10/2026:** AI Logs của mọi thành viên đã đủ và hợp lệ. Video chờ bản sản phẩm ổn định do các thành viên khác đang hoàn thiện. Bộ công việc riêng của BA/PO được quản lý tại [mục lục BA/PO](ba-po/README.md).

## 1. Nội dung có thể dán vào form

### Tên dự án đề xuất

**P97 — Trợ lý AI cấu hình xe và hỗ trợ báo giá VinFast**

### Mô tả ngắn

P97 giúp người mua cấu hình xe VinFast, xem chi phí lăn bánh tham khảo theo tỉnh/thành và trao đổi với trợ lý AI bằng tiếng Việt. Giá được tính bằng công cụ theo quy tắc nghiệp vụ; hệ thống hỗ trợ gửi yêu cầu đến đại lý, tư vấn viên kiểm tra/duyệt báo giá và xuất PDF.

### Mô tả chi tiết

**Bài toán**

Người mua cần hiểu các lựa chọn xe và từng khoản chi phí trước khi liên hệ đại lý. Tư vấn viên cần tiếp nhận yêu cầu có cấu hình rõ ràng và kiểm tra chính sách giá, phí, ưu đãi trên cùng nguồn dữ liệu. Dự án tập trung hỗ trợ luồng tìm hiểu xe và yêu cầu báo giá; mức tiết kiệm thời gian và tác động chuyển đổi sẽ được đo trong pilot.

**Giải pháp và phạm vi MVP**

P97 cung cấp giao diện chọn dòng xe, phiên bản, màu sắc, phương án pin, phụ kiện và tỉnh/thành đăng ký; hiển thị chi phí tham khảo; hỗ trợ hỏi đáp bằng tiếng Việt và thay đổi cấu hình bằng các lệnh được hỗ trợ. Khách có thể gửi yêu cầu đến đại lý; tư vấn viên quản lý lead, kiểm tra và duyệt/từ chối báo giá. Hệ thống hỗ trợ xuất PDF tham khảo và PDF từ dữ liệu báo giá đã lưu.

**Cách ứng dụng AI**

LangGraph điều phối mô hình ngôn ngữ và các công cụ nghiệp vụ. RAG hỗ trợ tra cứu nội dung tài liệu; giá của cấu hình được lấy từ dữ liệu có cấu trúc và tính bằng công cụ dùng chung với giao diện. Hệ thống có cơ chế hỏi lại khi thiếu thông tin và xử lý khi không có dữ liệu đủ tin cậy. AI hỗ trợ tư vấn; tư vấn viên vẫn là người kiểm tra điều kiện thương mại và xử lý báo giá.

**Tính khả thi và kiểm soát chất lượng**

Mã nguồn gồm frontend Next.js, backend FastAPI, cơ sở dữ liệu PostgreSQL và truy xuất pgvector. Các cơ chế đã triển khai gồm tính lại giá tại server khi gửi yêu cầu, lưu snapshot giá, chống tạo trùng yêu cầu, phân quyền theo đại lý và duyệt báo giá. Tính toán theo quy tắc giúp kiểm soát sai lệch, nhưng độ đúng thương mại vẫn phụ thuộc dữ liệu giá/phí/ưu đãi được xác minh. Báo giá được trình bày là tham khảo; duyệt báo giá không đồng nghĩa hoàn tất bán xe.

**Vai trò BA/PO và đánh giá sản phẩm**

BA/PO tập trung xác định vấn đề, phân định MVP, đặc tả quy tắc nghiệp vụ và tiêu chí nghiệm thu; thiết kế đánh giá khả năng hoàn thành tác vụ, tính nhất quán của giá, chất lượng câu trả lời AI và thời gian xử lý yêu cầu. Các mục tiêu về chuyển đổi, retention và ROI là giả thuyết cần kiểm chứng; nhóm chưa công bố chúng như kết quả thực tế.

**Định hướng phát triển**

Ưu tiên tiếp theo là xác minh dữ liệu với đại lý, chạy pilot có đo lường, hoàn thiện theo dõi chất lượng/chi phí AI và cải thiện trải nghiệm dựa trên phản hồi. Mô hình thuê bao đại lý và mở rộng kết nối nhiều đại lý sẽ được đánh giá sau khi chứng minh giá trị của luồng cốt lõi.

### Lưu ý trước khi sử dụng mô tả

Đoạn trên phản ánh mã nguồn được đọc, chưa xác nhận tính năng tương ứng trên bản public. Người phụ trách triển khai và BA/PO phải đối chiếu với bản live trước nộp; bỏ hoặc sửa mọi tính năng chưa chạy được trên bản gửi BGK. Chỉ thêm số test, người dùng hoặc kết quả pilot khi có bằng chứng.

### Các link cần điền

| Trường | Hiện có / việc cần hoàn thành |
|---|---|
| MVP | `https://c4-app-097.id.vn/` lấy từ ảnh form; cần kiểm tra end-to-end bằng trình duyệt ngoài nhóm |
| Video demo | Chưa thấy file/link trong repository đã đọc; phải ≤3 phút |
| Slides | Đã có bản 10 slides tại `outputs/ba-po-20261015/P97_Pitch_Deck_BA_PO_Review.pptx`; còn chờ ảnh/kết quả cuối và link chia sẻ |
| Thumbnail | Cần một ảnh đại diện có link công khai phù hợp form |

## 2. Đối chiếu 10 mục BTC yêu cầu cập nhật GitHub

| # | Mục BTC | Hiện trạng kiểm tra workspace | Việc cần hoàn tất / người phụ trách đề xuất |
|---|---|---|---|
| 1 | Source code | Có frontend, backend, tests và cấu hình deploy | Tech lead xác nhận commit nộp và đồng bộ GitHub; chưa kiểm tra remote |
| 2 | README.md | Đã sửa đoạn lịch sử chat/xác thực và thêm mục lục BA/PO | Dev review theo build cuối; nhóm bổ sung thông tin thành viên |
| 3 | Architecture diagram | Đã cập nhật PostgreSQL/pgvector, pricing và luồng PDF | Backend xác nhận lại đúng bản nộp |
| 4 | Đặc tả và thiết kế | Đã có PRD, US/BR/AC và hướng dẫn UAT; one-pager đã gắn nhãn định hướng ban đầu | BA/PO review quyết định đang mở cùng team |
| 5 | Tài liệu kiểm thử | Có tests và báo cáo đợt rà soát; eval report còn mẫu | QA/dev thêm kết quả có ngày/commit, UAT, lỗi còn lại và bằng chứng live |
| 6 | Weekly logs | Đã có bản ghi BA/PO ngày 15/10, ghi rõ AI hỗ trợ và giới hạn phạm vi | Các thành viên bổ sung việc tuần trước/việc riêng từ ghi chép thật |
| 7 | Live URL | Có URL trong ảnh; chưa xác minh truy cập được bằng công cụ | Người phụ trách deploy + người kiểm tra độc lập xác nhận |
| 8 | Video demo | `presentation/` hiện chỉ có README | Người phụ trách video quay/cắt ≤180 giây, mở quyền xem |
| 9 | Pitch deck | Đã soạn 10 slides PowerPoint, có link từ `presentation/README.md` | Bổ sung ảnh, kết quả UAT, tên nhóm và link cuối; xuất PDF sau khi chốt nếu cần |
| 10 | AI Log cập nhật hệ thống | Đã đủ và hợp lệ theo xác nhận của BA/PO ngày 15/10/2026 | Đã hoàn thành; giữ thông tin xác nhận để đối chiếu khi nộp |

“Chưa thấy” không đồng nghĩa nhóm chưa làm ở nơi khác. Cần gom bằng chứng và link vào một mục lục nộp bài. Không tạo nhật ký ngược ngày hoặc AI Logs giả. Nếu tổng hợp hồi cứu từ commit, ghi rõ nguồn và ngày tổng hợp; commit không chứng minh toàn bộ thời gian hay phân công.

**AI Logs đã hoàn thành theo xác nhận người dùng.** Một thành viên đại diện nộp và cập nhật bài. Phần còn phụ thuộc team là bản live cuối, bằng chứng kiểm thử và video.

## 3. Kịch bản video 3 phút

Mục tiêu dựng khoảng **2 phút 50 giây**, dành 10 giây dự phòng. Không dùng hướng dẫn 5 phút trong tài liệu cũ.

| Thời gian | Hình ảnh/thao tác | Ý chính lời nói |
|---|---|---|
| 0:00–0:20 | Tên dự án và một cấu hình mẫu | Ai gặp vấn đề, việc cần hoàn thành, P97 hỗ trợ gì |
| 0:20–0:50 | Chọn xe, màu và tỉnh; xem các khoản giá | Cùng một cấu hình có các khoản chi phí minh bạch; đây là giá tham khảo |
| 0:50–1:20 | Hỏi AI một câu có nguồn; thử một lệnh cấu hình đã kiểm tra | AI gọi công cụ; giá không do LLM tự tính; UI cập nhật theo lệnh được hỗ trợ |
| 1:20–1:55 | Gửi yêu cầu, chuyển tài khoản sale, mở và duyệt | Sale tiếp nhận cấu hình và kiểm tra; người có quyền quyết định nghiệp vụ |
| 1:55–2:15 | Mở PDF và chỉ trạng thái/chi phí | PDF giữ dữ liệu báo giá; không nói mọi PDF bắt buộc đã duyệt |
| 2:15–2:35 | Sơ đồ ngắn + kết quả kiểm thử có thật | Tách công cụ giá và RAG; trình bày đúng phạm vi bằng chứng |
| 2:35–2:50 | Vai trò BA/PO, bước pilot và link | Giá trị cần đo tiếp, định hướng và lời kết |

Dùng dữ liệu khách giả lập và tài khoản demo hạn quyền. Không quay mật khẩu, khóa API, dữ liệu khách thật. Được cắt thời gian chờ nhưng phải tránh tạo cảm giác sai về độ trễ; nếu dùng clip dự phòng, không gọi là thao tác live. Chỉ quay luồng đã pass trên bản nộp.

## 4. Dàn ý slides tự đọc được

Thông báo BTC không quy định số slide. Bản PowerPoint BA/PO hiện có 10 slides để review:

1. **Sản phẩm:** tên P97 và giá trị chính.
2. **Bài toán:** nhu cầu người mua/sale, đang gắn nhãn giả thuyết cần kiểm chứng.
3. **Giải pháp/MVP:** luồng từ cấu hình đến yêu cầu và sale xử lý.
4. **AI và kiểm soát:** vai trò AI, công cụ và tư vấn viên.
5. **Ví dụ quy tắc giá:** fixture tổng hợp, tách khoản ban đầu và tiền thuê pin định kỳ.
6. **Kiến trúc:** API, dữ liệu và công cụ giá dùng chung.
7. **Kiểm chứng:** bộ UAT/AI eval đã thiết kế; chờ kết quả và ảnh bản cuối.
8. **Kinh doanh:** phân khúc pilot, người trả tiền và mô hình thuê bao giả thuyết.
9. **Đo lường và BA/PO:** metric, kinh tế sản phẩm và đầu ra BA/PO.
10. **Hướng phát triển và bàn giao:** trạng thái hồ sơ, URL; cần thêm tên thành viên và link tài nguyên cuối.

Mỗi slide nên có kết luận rõ, nguồn/bằng chứng nhỏ bên dưới và giải thích đủ để BGK không cần nghe thuyết trình trực tiếp. Không để toàn bộ trọng tâm thành danh sách công nghệ.

Thumbnail đề xuất: tên P97, câu “Cấu hình xe · AI tư vấn · Báo giá minh bạch”, ảnh chụp giao diện thật. Đây là brief nội dung, chưa phải ảnh đã tạo. Không tự gán kích thước bắt buộc khi form chưa nêu.

## 5. Lịch hoàn thiện đến hạn nộp

| Ngày | Ưu tiên | Đầu ra kiểm tra được |
|---|---|---|
| 15/10 | Hoàn thiện tài liệu BA/PO; chốt phạm vi và người phụ trách; rà hồ sơ | Danh sách thiếu, commit dự kiến nộp, người chịu trách nhiệm từng mục; AI Logs đã hợp lệ |
| 16/10 | Sửa lỗi chặn luồng; UAT; phỏng vấn/test thuận tiện; cập nhật README/kiến trúc | Luồng demo chạy được, kết quả ghi chép, lỗi còn lại được phân loại |
| 17/10 | Đóng băng phạm vi; dựng slides; quay video; thumbnail; tổng hợp weekly logs | Bộ hồ sơ nháp đủ link, video dưới 3 phút, kiểm tra bởi người khác |
| 18/10 trước 18:00 | Kiểm tra bản live và mọi quyền truy cập; nộp sớm | Trạng thái bài nộp trên hệ thống, bằng chứng lưu, đủ AI Logs |
| 18/10 18:00–22:00 | Dự phòng sửa link hoặc lỗi nộp | Xác nhận lại hồ sơ hợp lệ; tránh đổi tính năng phút cuối |
| 18/10 23:00 | Hạn chót BTC | Không lấy đây làm thời điểm bắt đầu upload |

Sau checkpoint, nếu được chọn: chuẩn bị phần trình diễn ngày 22/10 theo hướng dẫn tiếp theo của BTC. Không giả định mọi nhóm đều được tham dự trình bày.

## 6. Checklist kiểm tra trước bấm nộp

- [ ] Một tên sản phẩm thống nhất; phần mô tả đúng tính năng bản public.
- [ ] Source code đã lên GitHub, commit nộp xác định được; không có secret/dữ liệu riêng trong hồ sơ chia sẻ.
- [ ] README và kiến trúc khớp triển khai; có mục lục dẫn tới đặc tả, test và weekly logs.
- [ ] Link MVP mở được từ mạng/trình duyệt ngoài nhóm; chức năng cần đăng nhập có hướng dẫn truy cập demo phù hợp.
- [ ] Video dài không quá 180 giây, âm thanh nghe rõ, không yêu cầu cấp quyền.
- [ ] Slide và thumbnail mở được; nội dung đọc rõ; link trỏ đúng bản cuối.
- [ ] Kết quả test/feedback ghi rõ ngày, phiên bản, phương pháp và giới hạn.
- [x] Mọi thành viên đã đủ AI Logs và hợp lệ, theo xác nhận của BA/PO ngày 15/10/2026.
- [ ] Đại diện nhóm nộp và kiểm tra trạng thái thành công/hợp lệ, lưu xác nhận.

Đã tạo bộ tài liệu BA/PO, workbook và bản PowerPoint để review. Video, thumbnail, bằng chứng UAT và link chia sẻ cuối chờ phần việc thực tế hoặc bản team bàn giao. Chưa upload, push GitHub hoặc nộp bài lên hệ thống BTC.
