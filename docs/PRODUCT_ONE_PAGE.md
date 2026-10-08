# PRODUCT ONE-PAGER: AUTOQUOTE AI (B2B2C PLATFORM)

*(Tên mã đề tài gốc: VF020-04 | Mô hình: B2B2C SaaS & Lead Marketplace)*

---

## 1. Bối cảnh & Vấn đề (Problem Statement)

* **Phía Người tiêu dùng (End-Consumers - C):**
  * Khách hàng muốn mua xe điện thường bị "ngợp" trước ma trận phiên bản, tùy chọn màu sắc, gói pin (mua đứt vs thuê pin) và đặc biệt là sự chênh lệch ưu đãi giữa các đại lý/showroom khác nhau (chính sách quà tặng, hỗ trợ trước bạ, voucher riêng của đại lý).
  * Để biết giá lăn bánh chính xác và so sánh ưu đãi, người mua phải tự liên hệ nhiều showroom, liên tục bị gọi điện làm phiền dù chưa sẵn sàng mua, hoặc nhận báo giá không rõ ràng từng dòng chi phí.
* **Phía Đại lý & Tư vấn viên bán hàng (Dealers / Sales - B):**
  * Chi phí chạy quảng cáo tìm kiếm khách hàng (Lead Acquisition Cost) ngày càng đắt đỏ nhưng tỷ lệ chuyển đổi thấp vì lead rác, lead lạnh nhiều.
  * Nhân viên tư vấn tốn 15–20 phút tính toán báo giá thủ công bằng Excel cho từng khách, dễ tính sai chính sách khuyến mãi đang áp dụng.
  * Khi tiếp nhận khách mới, sale không có bối cảnh (context): không biết khách đã thích màu gì, chọn pin gì, tài chính ra sao để tư vấn trúng đích ngay từ đầu.
* **Giải pháp trung gian (Platform Solution):**
  * Một nền tảng độc lập đóng vai trò cầu nối: cung cấp cho người dùng công cụ cấu hình xe trực quan, tương tác hai chiều thời gian thực với AI Agent (nói/chat đến đâu thì ảnh xe, màu sơn và bảng chiết tính lăn bánh tự động nhảy đến đó); đồng thời thu phí định kỳ (SaaS Subscription) từ các đại lý để đại lý cập nhật kho/chính sách và nhận về nguồn lead "nóng hổi" kèm toàn bộ tóm tắt nhu cầu.

---

## 2. Khách hàng mục tiêu & Mô hình kinh doanh (Target Audience & Business Model)

* **Đối tượng người dùng (Users):**
  * **C (Người mua xe):** Người dùng đại chúng có nhu cầu tìm hiểu xe điện, muốn tự do cấu hình xe trực quan, thử các mã khuyến mãi qua chat, nhận file PDF chiết tính chi phí minh bạch và chỉ kết nối với tư vấn viên khi thực sự có nhu cầu nhận ưu đãi tốt nhất.
  * **B (Đại lý & Nhân viên tư vấn - Showroom Sales):** Các đại lý/showroom ủy quyền tham gia nền tảng để đẩy tồn kho, cập nhật ưu đãi độc quyền và tiếp nhận khách hàng tiềm năng có mức độ quan tâm cao (High-intent Leads).
* **Mô hình doanh thu (Revenue Model):**
  * **B2B Subscription (Thu phí thuê bao):** Đại lý trả phí cố định theo tháng hoặc theo năm để sở hữu tài khoản đại lý (Dealer Portal), được đăng tải chính sách ưu đãi/tồn kho xe lên nền tảng, và nhận quyền tiếp nhận lead đổ về theo khu vực địa lý.

---

## 3. Ranh giới sản phẩm (Scope & Out of Scope)

* **In Scope (Phạm vi MVP):**
  * **Cổng Người dùng (Consumer Portal - Web Responsive Mobile-first):**
    * *Visual Configurator tương tác thời gian thực:* Hiển thị ảnh xe đổi màu/phiên bản và bảng chiết tính dòng tiền cập nhật tức thì theo từng thay đổi cấu hình.
    * *Trợ lý AI Copilot hai chiều:*
      * Nhận lệnh ngôn ngữ tự nhiên từ ô chat (ví dụ: "Đổi sang màu đỏ nóc đen, bản Plus, đăng ký ở Hà Nội").
      * Ngay lập tức bóc tách tham số và **điều khiển trực tiếp giao diện (Two-way State Sync)**: tự động đổi ảnh minh họa của xe, gạt đúng các nút chọn phiên bản, và gọi Python Pricing Engine cập nhật bảng chiết tính lăn bánh.
      * Tra cứu RAG chính sách voucher/ưu đãi từ cơ sở tri thức của các đại lý để giải thích điều kiện hợp lệ.
    * *Nút "Nhận báo giá & Ưu đãi tốt nhất":* Kết xuất file PDF Báo giá chính thức (có mã định danh Config ID) và kích hoạt cơ chế phát lead sang hệ thống đại lý.
    * *Điều hướng Zalo:* Sau khi có đại lý tiếp nhận, giao diện web hiển thị thẻ thông tin tư vấn viên kèm nút bấm chuyển hướng trực tiếp sang Zalo (Chat 1-1 qua Zalo cá nhân/OA) để chốt deal.
  * **Cổng Đại lý (Dealer Portal):**
    * Quản lý thông tin showroom, khu vực địa lý (Hà Nội, TP.HCM, tỉnh thành lân cận).
    * Bảng quản lý khuyến mãi: Cho phép đại lý tự tạo/cập nhật chương trình ưu đãi riêng để nạp vào cơ sở tri thức cho AI tra cứu.
    * Dashboard săn khách (Real-time Lead Claiming Queue):
      * Khi khách bấm "Nhận báo giá", hệ thống phát thông báo real-time đồng thời đến các đại lý/sale phù hợp theo khu vực.
      * **Cơ chế First-Come, First-Served:** Nút "Tiếp nhận khách" — sale nào bấm nhận trước sẽ giành được quyền chăm sóc khách hàng đó.
      * Sau khi nhận khách: Sale được xem toàn bộ **Hồ sơ cấu hình xe + Đoạn tóm tắt hội thoại giữa khách với AI Agent** để nắm trọn vẹn ngữ cảnh trước khi chat qua Zalo.
* **Out of Scope (Ranh giới dứt khoát không làm trong MVP):**
  * **Không làm tính năng chat nội bộ (In-app Chat):** Tránh tốn công xây dựng hệ thống chat thời gian thực phức tạp; nền tảng hoàn toàn chuyển đổi luồng nhắn tin sang Zalo.
  * **Không tích hợp cổng thanh toán trực tuyến:** Không thu cọc hay trừ thẻ ngân hàng trên web.
  * **Không tích hợp sâu hai chiều với DMS/ERP của đại lý:** Đại lý tự cập nhật tồn kho/ưu đãi qua giao diện quản trị CMS đơn giản của nền tảng.
  * **Không dựng mô hình 3D 360 độ nặng nề:** Sử dụng tập ảnh render 2D tĩnh đổi theo mã màu xe để tối ưu tốc độ tải trang.

---

## 4. Luồng vận hành thực tế (Operational Workflow)

[Khách hàng (C)]
   │ 1. Tùy biến xe (Visual Configurator) HOẶC Chat với AI Agent
   │    └── AI đổi ảnh minh họa xe + cập nhật bảng giá lăn bánh real-time
   │ 2. Nhấn nút [Nhận Báo Giá Chi Tiết]
   ▼
[Hệ thống Trung gian (AutoQuote Platform)]
   │ 3. Tạo file PDF Báo giá chuẩn gửi cho khách tải về
   │ 4. Lưu Snapshot hội thoại & Cấu hình xe
   │ 5. Bắn thông báo real-time tới danh sách Sale thuộc khu vực đăng ký biển số
   ▼
[Hàng đợi Đại lý (Dealer Portal - Realtime Queue)]
   │ 6. Sale A, Sale B, Sale C cùng thấy thông báo lead mới
   │ 7. Sale B bấm [TIẾP NHẬN KHÁCH] NHANH NHẤT (Claimed!)
   ▼
[Kết nối Chốt Deal qua Zalo]
   │ 8. Hệ thống mở khóa Snapshot nhu cầu & Lịch sử chat cho Sale B đọc
   │ 9. Giao diện khách hàng hiện thông tin Sale B + Nút "Mở Zalo nhắn tin với Sale B"
   └─► Hai bên trao đổi và chốt cọc qua Zalo.

---

## 5. Chỉ số thành công đo lường MVP (Success Metrics)

* **Pricing & UI Sync Accuracy:** Đạt **100%** độ chính xác tính toán chi phí lăn bánh (Python Engine) và 100% khớp lệnh giữa chat của AI và hình ảnh/bảng giá trên giao diện.
* **Lead Claim Latency (Tốc độ phản hồi):** Thời gian trung bình từ lúc khách bấm nhận báo giá đến khi có sale bấm nhận khách **< 60 giây**.
* **Lead Context Quality:** **100%** sale nhận khách nắm được chính xác cấu hình xe và các băn khoăn của khách mà không cần hỏi lại từ đầu nhờ bản tóm tắt của AI Agent.
* **Conversion to Zalo:** Tỷ lệ người dùng bấm nút mở Zalo để kết nối với tư vấn viên đạt **> 40%** trên tổng số lượt xuất file báo giá.

---

## 6. Lộ trình triển khai 4 tuần (4-Week Agile Roadmap)

* **Tuần 1: Nền tảng Dữ liệu & Core Engine (Data, Pricing & Two-way Sync)**

  * Thiết kế database PostgreSQL: Bảng xe, đại lý (dealers), khuyến mãi, leads và hàng đợi trạng thái (`pending` -> `claimed`).
  * Xây dựng Python Pricing Engine tính toán thuế phí lăn bánh chính xác tuyệt đối.
  * Cấu hình LangGraph Agent: Bóc tách tham số cấu hình xe, gọi tool tính giá và sinh structured payload để điều khiển UI.
* **Tuần 2: Hoàn thiện MVP Tính năng (Full-stack Integration & MVP Freeze)**

  * Dựng cổng C (Khách hàng): Visual stage đổi ảnh xe theo màu, bảng chiết tính lăn bánh đồng bộ hai chiều với ô chat AI, xuất file PDF báo giá và nút mở Zalo.
  * Dựng cổng B (Đại lý): Quản trị khuyến mãi và hàng đợi cướp lead real-time (First-Come, First-Served).
  * Đóng gói Docker Compose, deploy phiên bản Alpha lên môi trường online (Vercel + Render/Railway). **Hoàn tất MVP cuối tuần 2.**
* **Tuần 3: Trải nghiệm Người dùng, Khảo sát & Thu thập Phản hồi (User Testing & Feedback Loop)**

  * Cho người dùng thật (khách có nhu cầu mua xe) và 3–5 nhân viên sale đại lý đóng vai trải nghiệm thử hệ thống.
  * Thu thập dữ liệu: Ghi nhận tỷ lệ drop-off khi cấu hình, đo thời gian sale cướp lead, khảo sát mức độ hài lòng về tính tiện lợi khi chuyển hướng sang Zalo.
  * Tổng hợp danh sách lỗi tồn đọng (Bug tracker), các điểm nghẽn UX trên mobile và phản hồi về độ nhạy của AI Copilot.
* **Tuần 4: Tối ưu hóa Sản phẩm & Sẵn sàng Demo (Refinement & Demo Ready)**

  * Tinh chỉnh prompt và rule engine theo các trường hợp thực tế phát sinh từ tuần 3.

  ---

## 7. Stack công nghệ đề xuất

* RDB: supabase
* Auth: supabase auth
* Vector DB, RAG: supabase
* Backend: python
* Frontend: NextJS
* Deploy backend: Render
* Deploy Frontend: Vercel
* AI Monitoring: langfuse
* Git version: Github
