# Hướng dẫn từng bước hoàn thành bài nộp dự án P97 — BA/PO

Cập nhật hướng dẫn: **16/10/2026**. Làm theo thứ tự và tự đánh dấu checklist sau khi thực hiện. Tài liệu đã soạn là đầu vào để review; kết quả kiểm thử, phỏng vấn và trạng thái nộp bài phải ghi từ việc thực tế.

## 0. Đích đến và cách sử dụng

Theo thông báo BTC ngày 12/10/2026 bạn cung cấp:

- **Hạn nộp: 23:00 ngày 18/10/2026, giờ Việt Nam (UTC+7).**
- Form cần tên/mô tả dự án, MVP live, video **tối đa 3 phút**, slides và một thumbnail.
- GitHub cần cập nhật đủ 10 mục; có bảng đối chiếu và checklist ở cuối hướng dẫn.
- Một thành viên đại diện nhóm nộp/cập nhật bài trên cổng BTC.
- BGK xét chọn từ hồ sơ. Demo Day dự kiến ngày 22/10/2026.

**Đã hoàn thành:** AI Logs mọi thành viên đã đủ và hợp lệ theo xác nhận của bạn. Không cần làm lại.

**Đang phụ thuộc:** sản phẩm tiếp tục phát triển; UAT bản cuối, ảnh giao diện và video chờ team bàn giao.

Cách làm:

1. Làm **bước 1–5 ngay**, trong lúc team phát triển.
2. Có bản ứng viên thì làm **bước 6–9**: nhận bàn giao, kiểm tra và chốt phạm vi công bố.
3. Làm **bước 10–12**: slides, video, thumbnail và link cuối. Nội dung có thể chuẩn bị trước; ảnh/video dùng bản đã kiểm tra.
4. Làm **bước 13–16**: GitHub, form, kiểm tra độc lập và xác nhận nộp thành công.
5. Nếu bị chặn, ghi người xử lý/mốc cập nhật vào tab **Actions**, rồi tiếp tục việc độc lập. Không đánh dấu bị chặn là đã xong.

Các ngưỡng nghiệm thu, quy mô nghiên cứu và mốc nộp sớm dưới đây là **đề xuất quản lý của BA/PO**, không phải yêu cầu bổ sung được BTC công bố.

## Bước 1 — Mở tài liệu và chuẩn bị nơi lưu bằng chứng

**Bạn thực hiện:**

1. Mở [PRD](01_PRODUCT_REQUIREMENTS.md).
2. Mở [workbook BA/PO](../../outputs/ba-po-20261015/P97_BA_PO_Workbook.xlsx) bằng Excel hoặc công cụ tương thích. Có năm tab: **UAT, AI Eval, Discovery, Decisions, Actions**.
3. Mở [PowerPoint 10 slides](../../outputs/ba-po-20261015/P97_Pitch_Deck_BA_PO_Review.pptx).
4. Mở [nội dung form và timeline video](../FINAL_SUBMISSION_PLAN.md).
5. Tạo một thư mục làm việc của nhóm để lưu ảnh, PDF mẫu, kết quả test, video và slides cuối. Thống nhất ai sửa/xem; tài khoản và dữ liệu riêng giữ ở nơi riêng phù hợp.
6. Trước mỗi đợt test, lưu bản workbook theo ngày/build, ví dụ **P97_UAT_20261017_build-abc.xlsx**. Giữ cả bản lỗi và bản chạy lại.

**Đầu ra:** mở được tài liệu và có nơi lưu kết quả.

- [ ] Mở được PRD, workbook, PowerPoint và nội dung form.
- [ ] Đã có nơi lưu bằng chứng và quy ước tên file.
- [ ] Hiểu rằng ca đã thiết kế chưa phải ca đã chạy/đạt.

## Bước 2 — Chốt người phụ trách và mốc bàn giao

**Bạn thực hiện cùng team:**

1. Mở tab **Actions**. Với việc A02–A12, điền **Người nhận việc**, **Mốc nội bộ** và trạng thái.
2. Xác nhận người phụ trách dev/deploy, phối hợp test, quay video, thumbnail, review hồ sơ và đại diện nộp. Một người có thể nhận nhiều việc.
3. Thống nhất mốc có bản ứng viên đủ chạy luồng chính. Chỉ điền mốc được người nhận đồng ý.
4. Chọn mốc nộp nội bộ sớm hơn hạn BTC; gợi ý **trước 18:00 ngày 18/10** để dự phòng lỗi upload/quyền xem.

**Mẫu bạn tự gửi vào nhóm sau khi điền mốc:**

> Mình phụ trách chốt phạm vi, UAT và nội dung hồ sơ BA/PO. Nhờ team xác nhận người phụ trách bản live, phối hợp test, video, thumbnail và đại diện nộp. Mốc đề xuất nhận bản ứng viên là [ngày/giờ]. Bản bàn giao cần URL, commit/build, tính năng đã có, lỗi đã biết, tài khoản demo và dữ liệu test. Mình sẽ đối chiếu luồng cấu hình → giá → AI → gửi yêu cầu → sale xử lý → PDF trước khi chốt nội dung bài nộp.

**Đầu ra:** việc phụ thuộc có người thực sự nhận và thời điểm cập nhật.

- [ ] Các đầu mối đã nhận việc, có tên và mốc cụ thể.
- [ ] Có mốc bàn giao và mốc nộp nội bộ.
- [ ] Nhóm biết ai đại diện nộp bài.
- [x] AI Logs mọi thành viên đã đủ và hợp lệ theo xác nhận của bạn.

## Bước 3 — Review PRD, chốt phạm vi và quyết định nghiệp vụ

**Bạn thực hiện cùng team:**

1. Đọc mục 1–3 của [PRD](01_PRODUCT_REQUIREMENTS.md): vấn đề, đối tượng, MVP và hành trình.
2. Với mỗi tính năng, xác nhận: **có trên bản nộp**, **chưa xong/đưa roadmap**, hoặc **không thuộc phạm vi**.
3. Chốt luồng cốt lõi để nghiệm thu. Chỉ đưa quản trị kho, trả góp, 3D hoặc tính năng hỗ trợ vào bài nộp nếu team xác nhận sẵn sàng.
4. Review BR01–BR17 và acceptance criteria ở mục 4–5. Đặc biệt hỏi rõ giá pin, ưu đãi, giá thay đổi, quyền đại lý và PDF.
5. Mở tab **Decisions**, điền DEC01–DEC07: quyết định thực tế, người xác nhận, ngày và căn cứ. Điểm chưa chốt giữ trạng thái chờ, có người xử lý.
6. Cập nhật PRD theo quyết định, ghi ngày review/người tham gia. Khi phạm vi đổi, kiểm tra ảnh hưởng đến test, form và slides.

**Ba điểm cần làm rõ trước khi chốt nội dung:**

- Tên cuối và những tính năng thực sự có trên bản BGK truy cập.
- Cách gọi PDF và ai xác nhận điều kiện thương mại. API hiện không bắt buộc mọi PDF đã duyệt trước tải.
- Người xác nhận dữ liệu giá/phí/ưu đãi, nguồn, ngày hiệu lực và phần nào là dữ liệu demo.

**Đầu ra:** phạm vi và quy tắc thống nhất để kiểm tra.

- [ ] Tên sản phẩm/nhóm thống nhất.
- [ ] Có danh sách tính năng bản nộp và roadmap riêng.
- [ ] Quy tắc giá, ưu đãi, PDF và dữ liệu đã được review.
- [ ] Quyết định/câu hỏi còn mở có người chịu trách nhiệm.
- [ ] Không gọi tính năng chưa xong là đã hoàn thành.

## Bước 4 — Phỏng vấn vấn đề trong lúc chờ bản ổn định

Đây là việc áp dụng Product Discovery. Thông báo BTC được cung cấp không quy định số người phải phỏng vấn.

**Bạn thực hiện:**

1. Mở phần discovery trong [hướng dẫn kiểm chứng](02_VALIDATION_GUIDE.md).
2. Mời người đang tìm hiểu mua xe và/hoặc sale bạn tiếp cận được. Mục tiêu thuận tiện gợi ý là 3–5 người mua và 2–3 sale nếu có điều kiện.
3. Giới thiệu mục đích, xin đồng ý ghi chép ẩn danh; xin riêng nếu ghi âm.
4. Hỏi về **lần gần nhất** tìm giá/lập báo giá: từng bước, khó khăn, cách đang giải quyết và điều cần xác nhận. Chưa cần demo ở phần này.
5. Ghi tab **Discovery**: mã người, vai trò thật, ngày, sự đồng ý, quan sát gốc và diễn giải BA. Các cột tác vụ/thời gian chưa đo để trống hoặc ghi không áp dụng phù hợp.
6. Tổng hợp phát hiện nào ảnh hưởng đến US/BR hoặc thứ tự ưu tiên. Nếu không đổi gì, ghi lý do.

**Nếu chưa tuyển được người:** ghi chưa thực hiện, giữ vấn đề là giả thuyết và tiếp tục các bước khác. Nếu nhờ bạn học đóng vai, gọi đúng là usability với người đóng vai.

**Đầu ra:** ghi chép thật/giới hạn nghiên cứu và quyết định từ phản hồi.

- [ ] Đã ghi rõ có/chưa thực hiện và số người thực tế.
- [ ] Nếu thực hiện, có sự đồng ý và ghi chép ẩn danh.
- [ ] Quan sát gốc tách khỏi diễn giải của BA.
- [ ] Không viết phản hồi hoặc kết quả nghiên cứu chưa có.

## Bước 5 — Hoàn thiện kế hoạch sản phẩm, nhật ký và nội dung nháp

**Bạn thực hiện:**

1. Đọc [kế hoạch sản phẩm/đo lường](03_PRODUCT_OPERATING_PLAN.md), chọn metrics, giả thuyết và pilot phù hợp nhóm.
2. Phân biệt chỉ số **đã đo**, **mục tiêu**, **chưa đủ dữ liệu**. ROI và thuê bao vẫn là kế hoạch nếu chưa có số liệu/pilot.
3. Mở [JOURNAL.md](../../JOURNAL.md), bổ sung công việc thực tế ngày 16–18/10: việc làm, quyết định, đầu ra, khó khăn và bước tiếp theo.
4. Nhờ thành viên bổ sung weekly logs các tuần trước từ ghi chép thật. Nếu tổng hợp hồi cứu, ghi ngày tổng hợp và nguồn.
5. Chuẩn bị phần chữ slides: bài toán, MVP, vai trò AI, hướng phát triển. Ảnh/kết quả cuối chờ bước 10.

**Đầu ra:** nội dung BA/PO để review và nhật ký đúng thực tế.

- [ ] Có kế hoạch đo giá trị, chất lượng AI và chi phí.
- [ ] Giả định GTM, growth và ROI có nhãn rõ.
- [ ] Nhật ký đã bổ sung việc thật; biết ai còn phải bổ sung.
- [ ] Nội dung slides có thể làm trước đã được chuẩn bị.

## Bước 6 — Nhận bản ứng viên và kiểm tra nhanh luồng chính

**Chỉ chạy phần này khi team đã bàn giao bản đủ dùng.** Nếu chưa có, cập nhật A04 trong **Actions**, tiếp tục bước 4–5 và chuẩn bị lời dẫn video.

**Nhờ dev cung cấp và ghi lại:**

| Thông tin | Bạn điền giá trị thực tế |
|---|---|
| URL bản ứng viên | Link trong form cũ là https://c4-app-097.id.vn/; cần xác nhận URL cuối |
| Commit/build, ngày deploy | Chưa điền |
| Tính năng và lỗi đã biết | Chưa điền |
| Version/nguồn dữ liệu, phần demo | Chưa điền |
| Tài khoản test và vai trò | Nhận qua kênh riêng; không ghi mật khẩu vào tài liệu công khai |
| Người hỗ trợ khi lỗi | Chưa điền |

**Bạn thử một lượt:**

1. Mở trình duyệt/phiên mới, truy cập URL.
2. Chọn cấu hình có dữ liệu; xem các khoản và tổng giá.
3. Hỏi AI một câu có nguồn, thử một lệnh đổi cấu hình được hỗ trợ.
4. Gửi yêu cầu bằng dữ liệu khách test đến đại lý đã chọn.
5. Đăng nhập sale có quyền, tìm yêu cầu vừa gửi và xử lý.
6. Mở PDF, kiểm tra chữ tiếng Việt, số tiền, nhãn/trạng thái.
7. Ghi lỗi chặn để team sửa trước khi quay video.

**Đầu ra:** đủ thông tin chạy nghiệm thu hoặc danh sách lỗi bàn giao.

- [ ] Có URL, build, dữ liệu và tài khoản kiểm tra.
- [ ] Luồng chính chạy được hoặc lỗi chặn có người xử lý/mốc cập nhật.
- [ ] Dùng dữ liệu test, tránh tạo yêu cầu khách thật ngoài chủ đích.

## Bước 7 — Chạy UAT và lưu bằng chứng từng ca

**Mở:** tab **UAT** và [hướng dẫn kiểm chứng](02_VALIDATION_GUIDE.md).

**Bạn thực hiện:**

1. Đối chiếu 33 ca với phạm vi. Ca ngoài phạm vi có lý do/quyết định PO; không loại ca chỉ để tăng tỷ lệ đạt.
2. Chạy **P0 thuộc phạm vi trước**, rồi P1. Ca đổi giá, xung đột hoặc quyền hai đại lý nhờ QA/dev phối hợp.
3. Đọc tiền điều kiện/kỳ vọng trước khi thao tác.
4. Điền đầy đủ: **Trạng thái, Thực tế/lý do, Bằng chứng, Build/môi trường, Người kiểm tra, Ngày chạy**.
5. Đặt tên ảnh ví dụ **UAT15_build-abc_20261017.png**, lưu nơi nhóm mở được. Ca đạt cũng cần bằng chứng thích hợp.
6. Nếu lỗi, ghi mã ca, bước tái hiện, kỳ vọng, thực tế và ảnh hưởng; thêm việc sửa vào **Actions** hoặc công cụ nhóm.
7. Sau sửa, chạy lại ca lỗi và ca liên quan; giữ lịch sử theo ngày/build/run.

| Trạng thái | Cách dùng |
|---|---|
| Chưa chạy | Chưa thực hiện ca |
| Đạt | Đã chạy, khớp kỳ vọng và có bằng chứng |
| Không đạt | Đã chạy, sai kỳ vọng |
| Bị chặn | Thiếu môi trường/dữ liệu/tài khoản hoặc không đi tiếp được |
| Không áp dụng | Ngoài phạm vi đã quyết định, có lý do |

**FX01 là dữ liệu tổng hợp kiểm tra công thức, không phải giá VinFast thực.** Nhờ dev chuẩn bị ở môi trường test; không tự sửa dữ liệu vận hành. Thiếu điều kiện chạy thì ghi bị chặn và nhờ QA/dev cung cấp bằng chứng đúng môi trường.

Workbook chỉ kiểm tra mức đầy đủ của hồ sơ ca, không tự chấm chất lượng bằng chứng. Công thức tổng hợp dùng vùng dòng đã chuẩn bị; thêm ca ngoài vùng phải cập nhật công thức. Ca P0 không áp dụng cần PO review, bộ đếm không tự coi là đã đạt.

**Đầu ra:** kết quả từng ca gắn với phiên bản và bằng chứng.

- [ ] P0 thuộc phạm vi đã có kết quả/bằng chứng.
- [ ] Ca chưa chạy, bị chặn, không áp dụng được ghi đúng và có lý do.
- [ ] Lỗi có người xử lý, đã chạy lại sau sửa.
- [ ] Luồng định công bố sẵn sàng không còn lỗi nghiêm trọng về tiền, mất yêu cầu hoặc dữ liệu sai phạm vi.

## Bước 8 — Đánh giá AI và trải nghiệm người dùng

**Bạn thực hiện:**

1. Mở **AI Eval**, đọc 20 tình huống; thay nội dung như **[màu có trong catalog]** bằng lựa chọn thực tế.
2. Chuẩn bị nguồn chuẩn với người phụ trách AI/dữ liệu. Giá đối chiếu tool/fixture; tri thức đối chiếu tài liệu đúng phiên bản.
3. Chạy ca thuộc phạm vi, ghi câu trả lời thực tế, nguồn, bằng chứng, model/build/run, người chấm và ngày.
4. Ưu tiên thiếu tỉnh/cấu hình, ưu đãi có điều kiện, cộng dồn, đổi xe giữa hội thoại, thiếu nguồn và tool lỗi.
5. Với ca ngẫu nhiên, gợi ý chạy lặp ba lần ở bản cuối và lưu từng run bằng bản workbook riêng. Đây là khuyến nghị ổn định, không phải số lần BTC bắt buộc.
6. Nếu có người dùng thử, giao tác vụ U1–U3/S1 trong hướng dẫn; ghi thời gian, hoàn thành đúng và có/không trợ giúp vào **Discovery**.

**Nếu chưa có người ngoài nhóm:** vẫn có thể kiểm tra nội bộ và ghi đúng vai trò. Không gọi đó là kết quả khách hàng thật hoặc nghiên cứu đại diện thị trường.

**Đầu ra:** kết quả AI/trải nghiệm và giới hạn cần công khai đúng.

- [ ] Ca AI đã chạy có câu trả lời, nguồn và bằng chứng.
- [ ] Sai tiền/điều kiện/ngữ cảnh không được chấm đạt vì viết trôi chảy.
- [ ] Lỗi nghiêm trọng có quyết định sửa/điều chỉnh phạm vi; luồng chưa khắc phục chưa coi sẵn sàng.
- [ ] Kết quả usability hoặc việc chưa thực hiện được ghi đúng.

## Bước 9 — Chốt báo cáo và quyết định nghiệm thu

**Bạn thực hiện:**

1. Review **UAT + AI Eval + lỗi còn lại + phạm vi bản nộp**. Bộ đếm P0 trong UAT không bao gồm toàn bộ lỗi AI hoặc chất lượng trải nghiệm.
2. Điền [báo cáo đánh giá](../../eval/results/report.md): ngày/build, số ca mỗi trạng thái, lỗi còn lại, bằng chứng, người tham gia nếu có và giới hạn.
3. Các số mục tiêu trong mẫu như **>80%**, **<3s** không phải actuals. Bỏ hướng dẫn mẫu không dùng hoặc ghi chưa đo.
4. Ghi quyết định luồng nào sẵn sàng, luồng nào chờ sửa/chuyển roadmap; người xác nhận và ngày vào **Decisions** hoặc biên bản.
5. Khi có thay đổi sau nghiệm thu, hỏi dev phần ảnh hưởng và chạy lại ca liên quan trước cập nhật hồ sơ/quay.

**Mẫu điền bằng số thật:**

> Ngày [ngày], trên [URL/build], nhóm chạy [số] ca thuộc [phạm vi]. Kết quả: [số] đạt, [số] không đạt, [số] bị chặn, [số] chưa chạy, [số] không áp dụng có lý do. Lỗi còn lại là [mã/lỗi]. Nhóm quyết định [sửa/giảm phạm vi/ghi giới hạn]. Bằng chứng: [link]. Người xác nhận: [tên].

**Gần hạn vẫn có lỗi chặn:** báo team/người nộp ngay; đề nghị sửa hoặc giảm phạm vi và cập nhật đồng bộ form/slides/video. Cách viết hồ sơ không thay thế được MVP live bắt buộc.

**Đầu ra:** báo cáo thật và danh sách tuyên bố đúng bản nộp.

- [ ] Có kết quả/quyết định nghiệm thu gắn phiên bản.
- [ ] Các trạng thái được đếm riêng và đúng.
- [ ] Không công bố kết quả kinh doanh/người dùng thiếu bằng chứng.
- [ ] Đã xác nhận bản dùng chụp ảnh/quay.

## Bước 10 — Hoàn thiện slides

**Mở:** [PowerPoint](../../outputs/ba-po-20261015/P97_Pitch_Deck_BA_PO_Review.pptx) và bảng từng slide trong [hướng dẫn bàn giao](04_SUBMISSION_HANDOFF.md).

**Bạn thực hiện:**

1. Lưu bản chỉnh sửa cuối có tên/phiên bản dễ phân biệt.
2. Slide 1–2: điền tên cuối, nhóm; cập nhật phát hiện người dùng nếu có, nếu chưa giữ nhãn giả thuyết.
3. Slide 3–4: khớp luồng/tính năng và vai trò AI với bản đã kiểm tra.
4. Slide 5: ví dụ FX01 giữ nhãn tổng hợp, không gọi là giá bán thực.
5. Slide 6: nhờ dev xác nhận kiến trúc theo build cuối.
6. Slide 7: cập nhật số ca thật, ngày/build, giới hạn và ảnh giao diện. Ưu tiên ảnh cấu hình/bảng giá và xử lý yêu cầu; ẩn dữ liệu riêng.
7. Slide 8–9: GTM/thuê bao/ROI giữ dạng giả thuyết hoặc kế hoạch nếu chưa có kết quả.
8. Slide 10: điền thành viên/vai trò, link cuối và hướng phát triển; thay ghi chú chờ bàn giao bằng trạng thái thực tế.
9. Xem từng slide ở chế độ trình chiếu: chữ/ảnh rõ, không ô hướng dẫn chưa xử lý, không sai số liệu.
10. Nếu xuất PDF, mở lại file xuất kiểm tra trang/chữ. Upload bản cuối và kiểm tra quyền xem.

**Đầu ra:** slides tự giải thích được bài toán, giải pháp, tính khả thi, hướng phát triển.

- [ ] Nội dung khớp bản nghiệm thu và có thông tin nhóm.
- [ ] Ảnh/số liệu/giới hạn/nhãn giả thuyết chính xác.
- [ ] Không còn ghi chú nháp vô ý.
- [ ] Link slides cuối mở được với quyền xem dự kiến cho BGK.

## Bước 11 — Quay video khi luồng ổn định

Chuẩn bị lời dẫn được ngay; quay thao tác sau bước 6–9.

**Bạn phối hợp người quay:**

1. Mở timeline trong [kế hoạch nộp](../FINAL_SUBMISSION_PLAN.md). Mục tiêu **2 phút 50 giây**, tối đa **3 phút**.
2. Chuẩn bị dữ liệu demo, tài khoản hạn quyền, cấu hình và PDF trên bản đã kiểm tra.
3. Chạy thử kịch bản một lần; chỉ demo lệnh/tính năng được hỗ trợ thực tế.
4. Quay vấn đề ngắn, luồng cấu hình/AI/yêu cầu/sale/PDF, bằng chứng và hướng phát triển. Không cần đưa mọi tính năng vào.
5. Cắt dựng và kiểm tra thời lượng/giọng nói. Có thể cắt chờ, tránh tạo hiểu sai về độ trễ hoặc gọi clip dựng là thao tác live.
6. Xem toàn bộ file cuối, kiểm tra không lộ mật khẩu, API key hoặc thông tin khách thật.
7. Upload YouTube/Google Drive theo form hỗ trợ, chờ xử lý xong, thử link bằng phiên không có quyền chủ sở hữu.

**Đầu ra:** video đúng bản nộp, phát được và dài không quá 180 giây.

- [ ] Thời lượng ≤3 phút, âm thanh/hình ảnh rõ.
- [ ] Luồng và tuyên bố khớp bản nghiệm thu.
- [ ] Không lộ thông tin riêng.
- [ ] Link phát được, không xin quyền hoặc còn xử lý.

## Bước 12 — Làm thumbnail và gom link cuối

**Bạn hoặc người được nhóm phân công:**

1. Chọn ảnh UI thực tế đã kiểm tra, ẩn dữ liệu riêng.
2. Thêm tên P97 và câu giá trị ngắn, ví dụ “Cấu hình xe, AI tư vấn, báo giá minh bạch”.
3. Xuất một ảnh đại diện. Ảnh thông báo/form chưa nêu kích thước bắt buộc; kiểm tra thêm yêu cầu thực tế trên cổng nếu có.
4. Upload ảnh, thử link theo định dạng form chấp nhận; dùng chức năng xem trước nếu có.
5. Điền bảng dưới bằng link cuối. Không nộp đường dẫn trên máy như **C:/...** cho BGK.

| Tài nguyên | Link cuối — bạn thay nội dung cột này |
|---|---|
| MVP | Chưa chốt; xác nhận URL cuối |
| GitHub repository | Chưa điền |
| Video demo | Chờ bản cuối |
| Slides | Chờ bản chia sẻ cuối |
| Thumbnail | Chờ ảnh cuối |
| Tài liệu/bằng chứng nếu cần | Chưa điền |

**Đầu ra:** thumbnail và một danh sách link thống nhất cho form/README/slides.

- [ ] Thumbnail rõ, đúng sản phẩm và được form chấp nhận.
- [ ] Link ảnh mở/hiển thị được.
- [ ] Bảng link đã thay bằng tài nguyên cuối thực tế.

## Bước 13 — Cập nhật GitHub đủ 10 mục

**Bạn phối hợp người phụ trách repo:**

1. Review các file local cần nộp. Có trên máy chưa đồng nghĩa đã có trên GitHub.
2. Nhờ dev xác nhận source code, README, kiến trúc đúng bản live cuối.
3. Cập nhật README gốc với link cuối; dẫn tới PRD, tài liệu test/kết quả và weekly logs.
4. Đưa workbook kết quả/slides cuối hoặc link của chúng vào nơi dễ tìm. File trong **scratch/ba-po-artifacts/** là file tạm, không cần nộp.
5. Người phụ trách Git commit/push theo quy trình nhóm; ghi commit/nhánh bản nộp.
6. Mở **trên GitHub** để kiểm tra. Repo riêng tư cần xác nhận cách BGK được cấp quyền theo BTC; chưa rõ thì người đại diện hỏi BTC trước hạn.

| # | Mục BTC | Kiểm tra ở đâu | Đánh dấu sau kiểm tra |
|---|---|---|---|
| 1 | Source code | Repo/nhánh bản nộp, frontend và backend | [ ] |
| 2 | README.md | README gốc, thông tin sản phẩm/chạy/nhóm/link | [ ] |
| 3 | Architecture diagram | [Sơ đồ kiến trúc](../architecture_diagram.md), dev review | [ ] |
| 4 | Đặc tả và thiết kế | PRD và tài liệu thiết kế, có dẫn từ README | [ ] |
| 5 | Tài liệu kiểm thử | Bộ ca, kết quả thực tế, lỗi/giới hạn | [ ] |
| 6 | Weekly logs | JOURNAL/tài liệu nhóm có ghi chép thật | [ ] |
| 7 | Live URL | URL hoạt động, hướng dẫn trải nghiệm | [ ] |
| 8 | Video Demo | Link cuối, không quá 3 phút | [ ] |
| 9 | Pitch Deck | File/link slides cuối | [ ] |
| 10 | AI Log cập nhật hệ thống | Đã đủ và hợp lệ theo xác nhận của bạn | [x] |

Ô trong bảng sửa thủ công. Checklist Markdown riêng nằm ở cuối hướng dẫn.

**Đầu ra:** BGK đi từ README trên GitHub tới được hồ sơ cần xem.

- [ ] File cần nộp đã lên đúng repo/nhánh.
- [ ] Có commit bản nộp và link bằng chứng.
- [ ] Quyền repo/tài nguyên phù hợp yêu cầu BTC.
- [ ] Đã đối chiếu đủ 10 mục.

## Bước 14 — Điền form và lưu nháp

**Bạn hoặc đại diện nhóm:**

1. Mở cổng Phoenix từ link BTC cung cấp, dùng đúng tài khoản/nhóm.
2. Kiểm tra nhóm/thành viên/dự án đang mở. Nếu có trường ngoài ảnh đã cung cấp, điền theo yêu cầu thực tế của cổng.
3. Sao chép tên, mô tả ngắn/chi tiết từ [nội dung form](../FINAL_SUBMISSION_PLAN.md) sau khi đã sửa theo phạm vi/kết quả cuối.
4. Dán link MVP, video, slides, thumbnail ở bước 12; điền repo ở nơi cổng yêu cầu nếu có.
5. Đọc lại bản hiển thị, sửa Markdown/xuống dòng và bỏ tuyên bố thiếu căn cứ.
6. Bấm **Lưu nháp** nếu có như ảnh form; chờ phản hồi, mở lại kiểm tra dữ liệu được giữ.
7. Nhờ người trong nhóm review bản nháp qua kênh bạn sử dụng.

**Đầu ra:** bản nháp đủ thông tin/link. **Lưu nháp chưa phải đã nộp.**

- [ ] Đúng nhóm/dự án, đủ trường bắt buộc trên cổng.
- [ ] Form/slides/video thống nhất phạm vi.
- [ ] Không có link mẫu, placeholder hoặc đường dẫn local.
- [ ] Đã lưu và mở lại bản nháp.

## Bước 15 — Kiểm tra độc lập trước khi nộp

**Nhờ một thành viên khác** dùng phiên mới/tài khoản không phải chủ tài nguyên. Cổng nộp có thể cần đăng nhập; quyền video/slides/ảnh phải phù hợp để người chấm truy cập.

1. Mở MVP, thử luồng chính bằng dữ liệu demo được phép.
2. Nếu sale cần đăng nhập, có hướng dẫn trải nghiệm phù hợp quy trình BTC. Không đưa tài khoản quản trị hoặc secret lên repo công khai.
3. Mở video, xem thời lượng; mở slides và thumbnail.
4. Mở repo theo quyền dự kiến, tìm tài liệu từ README.
5. Đọc form như người lần đầu biết dự án: hiểu bài toán, giải pháp, tính khả thi và hướng phát triển không?
6. Ghi người kiểm tra, thời gian, lỗi/link lỗi vào **Actions**, sửa và thử lại.

**Đầu ra:** một người khác xác nhận hồ sơ đọc/xem/trải nghiệm được.

- [ ] MVP và luồng công bố chạy được.
- [ ] Video/slides/thumbnail mở được, không xin quyền ngoài dự kiến.
- [ ] Tài liệu GitHub tìm được, link đúng.
- [ ] Người review xác nhận; lỗi quan trọng đã xử lý.

## Bước 16 — Nộp và xác nhận hệ thống đã nhận bài

**Đại diện nhóm thực hiện trước hạn:**

1. Mở bản nháp đúng nhóm, rà checklist tổng bên dưới.
2. Bấm **Nộp bài** khi sẵn sàng, xử lý lỗi validation thực tế nếu có.
3. Chờ phản hồi, đọc trạng thái hệ thống. Không coi việc bấm nút là bằng chứng thành công.
4. Mở lại bài nộp, kiểm tra trường/link và xác nhận không chỉ còn là bản nháp.
5. Lưu ảnh/thông tin xác nhận, thời gian và mã bài nếu hệ thống cung cấp.
6. Báo nhóm qua kênh của bạn: nộp lúc nào, trạng thái gì, link/bằng chứng nào.
7. Nếu cập nhật trước hạn, làm theo chức năng cổng và kiểm tra trạng thái sau cập nhật. Lỗi không xử lý được thì liên hệ BTC ngay với ảnh lỗi/thời gian và giữ bằng chứng.

**Đầu ra:** hệ thống ghi nhận bài nộp, có bằng chứng và nhóm biết trạng thái.

- [ ] Đã thực hiện nộp trước 23:00 ngày 18/10/2026.
- [ ] Đã đọc trạng thái và mở lại bài kiểm tra.
- [ ] Có bằng chứng, thời gian, mã bài nếu có.
- [ ] Đã báo nhóm; cập nhật cuối nếu có được xác nhận lại.

## Checklist tổng trước và sau khi nộp

Chỉ đánh dấu sau kiểm tra. Nghiên cứu/ROI chưa có kết quả thì ghi đúng là kế hoạch; không tự thêm chúng thành điều kiện BTC bắt buộc.

### A. Phần BA/PO

- [ ] Team review tên, vấn đề, người dùng và phạm vi bản nộp.
- [ ] US/BR/AC và quyết định còn mở có người chịu trách nhiệm.
- [ ] Tính năng live được tách rõ khỏi roadmap.
- [ ] Kết quả UAT/AI có build/bằng chứng, lỗi còn lại được ghi đúng.
- [ ] Số liệu/phản hồi thật có nguồn; phần chưa đo gắn nhãn giả thuyết/kế hoạch.
- [ ] Không gọi duyệt báo giá là hoàn tất bán xe/doanh thu.
- [ ] PDF tham khảo và vai trò sale được mô tả đúng.
- [ ] Nhật ký ghi công việc thực tế.

### B. Mười mục GitHub/hệ thống theo BTC

- [ ] Source code trên repo bản nộp.
- [ ] README thông tin/link cuối.
- [ ] Sơ đồ kiến trúc đúng bản cuối.
- [ ] Đặc tả và thiết kế.
- [ ] Tài liệu kiểm thử, kết quả/giới hạn thật.
- [ ] Weekly logs của nhóm.
- [ ] Live URL và hướng dẫn trải nghiệm.
- [ ] Video Demo cuối ≤3 phút.
- [ ] Pitch Deck cuối.
- [x] AI Logs mọi thành viên đã đủ và hợp lệ theo xác nhận của bạn.

### C. Form và tài nguyên

- [ ] Đúng nhóm/dự án, đủ trường bắt buộc thực tế.
- [ ] Tên/mô tả đúng phạm vi cuối.
- [ ] Link MVP hoạt động.
- [ ] Link video phát được, ≤180 giây.
- [ ] Slides mở được, không ghi chú nháp vô ý.
- [ ] Thumbnail mở/hiển thị theo cách form chấp nhận.
- [ ] Quyền repo/tài nguyên phù hợp để BGK truy cập.
- [ ] Có người khác kiểm tra độc lập.

### D. Xác nhận nộp

- [ ] Đã bấm Nộp bài, không chỉ Lưu nháp.
- [ ] Cổng ghi nhận bài, trạng thái đã đọc/kiểm tra lại.
- [ ] Có bằng chứng và thời gian trước hạn.
- [ ] Nhóm được thông báo và biết ai phụ trách cập nhật cuối.

## Lịch gợi ý từ 16/10 đến hạn nộp

Đây là mốc nội bộ đề xuất; cập nhật theo lịch team thực sự nhận. Nếu bản ứng viên trễ, ưu tiên luồng cốt lõi, nghiệm thu và tài nguyên bắt buộc; không bỏ yêu cầu BTC.

| Thời gian | Ưu tiên |
|---|---|
| 16/10 | Bước 1–5: nhận việc, review phạm vi/quy tắc, quyết định, phỏng vấn nếu tiếp cận được, chuẩn bị nội dung |
| Có bản ứng viên, mục tiêu trong 16–17/10 | Bước 6–9: kiểm tra, UAT/AI, sửa lỗi, chốt phạm vi công bố |
| 17/10, sau khi luồng ổn định | Bước 10–12: ảnh/slides cuối, video ≤3 phút, thumbnail/link |
| 18/10 trước 18:00, mốc gợi ý | Bước 13–16: GitHub, form, kiểm tra độc lập, nộp sớm |
| 18/10 từ 18:00 đến trước 23:00 | Dự phòng lỗi nộp/link, xác nhận cập nhật; hạn BTC là 23:00 |

## Tra cứu tài liệu

| Bạn cần | Mở file |
|---|---|
| Phạm vi, quy tắc, US/AC | [01_PRODUCT_REQUIREMENTS.md](01_PRODUCT_REQUIREMENTS.md) |
| Test, discovery, dữ liệu chuẩn | [02_VALIDATION_GUIDE.md](02_VALIDATION_GUIDE.md) |
| Metrics, GTM, growth, ROI, adoption | [03_PRODUCT_OPERATING_PLAN.md](03_PRODUCT_OPERATING_PLAN.md) |
| Mẫu bàn giao, bổ sung từng slide | [04_SUBMISSION_HANDOFF.md](04_SUBMISSION_HANDOFF.md) |
| Ghi kết quả/quyết định/công việc | [Workbook BA/PO](../../outputs/ba-po-20261015/P97_BA_PO_Workbook.xlsx) |
| Slides chỉnh sửa | [PowerPoint](../../outputs/ba-po-20261015/P97_Pitch_Deck_BA_PO_Review.pptx) |
| Nội dung form, timeline video | [FINAL_SUBMISSION_PLAN.md](../FINAL_SUBMISSION_PLAN.md) |
| Áp dụng Track 1 | [BA_PO_TRACK1_APPLICATION.md](../BA_PO_TRACK1_APPLICATION.md) |
| Báo cáo kết quả cần điền | [eval/results/report.md](../../eval/results/report.md) |
| Nhật ký cần bổ sung | [JOURNAL.md](../../JOURNAL.md) |

Quy ước: ô trống là chưa có dữ liệu; số 0 là kết quả thực bằng 0. Checklist không thay thế bằng chứng. Hoàn tất bài nộp khi hồ sơ đúng bản sản phẩm, đủ mục BTC và hệ thống xác nhận đã nhận bài.
