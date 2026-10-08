# Kế hoạch triển khai Supabase cho dữ liệu AI

Ngày: 2026-10-08. Căn cứ: [thiết kế đã duyệt](../specs/2026-10-08-supabase-ai-data-design.md).

## Cách thực hiện

Thực hiện tuần tự trong phiên làm việc hiện tại, không dùng sub-agent. Hoàn tất kiểm chứng code và công cụ import trước khi sửa DB thật. Giữ các thay đổi đang có ở Dockerfile, `.dockerignore` và guide; không hoàn tác thay đổi của người dùng. Không đưa file dữ liệu riêng vào Git.

## 1. Migration và hợp đồng dữ liệu

- Đọc skill Supabase và Postgres best practices trước khi viết SQL. Kiểm tra migration runner, baseline schema và lịch sử migration live.
- Tạo migration mới cài vector và ba bảng `ai_data` theo thiết kế; bổ sung ràng buộc active, khóa ngoại, index lọc và RLS/revoke. Không cập nhật các bảng nghiệp vụ.
- Đảm bảo bootstrap DB mới và upgrade DB hiện có đều áp dụng migration mới qua runner. Baseline vẫn chỉ mô tả phần nghiệp vụ, migration là nguồn định nghĩa schema AI.
- Viết fixture tổng hợp nhỏ cho tám bảng catalog và các record vector. Không dùng nội dung dataset riêng làm fixture.
- Kiểm tra schema trên PostgreSQL có vector: ràng buộc, quyền và tối đa một dataset active.

Kết quả: migration có thể kiểm chứng độc lập, chưa thay đổi DB thật.

## 2. Import dữ liệu riêng

- Tạo `scripts/db/import_ai_data.py`; tách phần đọc/validate nguồn khỏi phần ghi DB để có thể test không cần kết nối.
- Cung cấp `plan`, `apply`, `check`, `activate`, với `--source-dir`, `--web-sources-file` và dataset ID phù hợp từng lệnh. Kết nối dùng `MIGRATION_DATABASE_URL`, fallback `DATABASE_URL`; chuẩn hóa driver URL cho psycopg2.
- Kiểm tra header, tham chiếu và vector; tạo manifest có digest từng nguồn. Giữ chuỗi CSV, thứ tự dòng và record JSON gốc.
- `apply` dùng transaction và advisory lock; phiên bản cùng manifest là no-op; chỉ kích hoạt sau kiểm tra toàn bộ. Fingerprint bảng nghiệp vụ trước/sau bảo đảm importer không sửa dữ liệu hiện có.
- `check` có hai chế độ: đối chiếu nguồn riêng hoặc xác minh trạng thái DB. `activate` xác minh phiên bản rồi đổi active trong transaction.
- Test dữ liệu lỗi, import lặp, lỗi giữa transaction, rollback phiên bản và tranh chấp activation. Không in credential hoặc embedding ra log.

Kết quả: công cụ quản trị chạy được từ máy có dữ liệu riêng, không phụ thuộc deploy.

## 3. Repository và catalog backend

- Tạo repository đồng bộ có pool giới hạn, timeout, truy vấn có tham số và hoàn trả kết nối an toàn. Dùng psycopg2 hiện có; không gọi async engine bằng `asyncio.run` trong tool.
- Thêm context ghim dataset cho mỗi lượt gọi agent trong worker thread tại `src/api/routes.py`. Tool gọi trực tiếp ngoài route tự lấy một phiên bản nhất quán cho lần gọi đó.
- Đổi `src/agents/tools/vinfast_tools.py` sang catalog Supabase. Bỏ đường dẫn/fallback local; cache theo dataset ID, tối đa hai phiên bản.
- Đổi `src/agents/tools/web_lookup.py` sang cấu hình nguồn trong dataset. Giữ whitelist/HTTPS/redirect/timeout hiện tại; thiếu cấu hình báo không khả dụng.
- Test hợp đồng tool, công thức chi phí và promotion bằng nguồn tổng hợp; kiểm tra không đọc file dữ liệu local và ghim phiên bản qua nhiều tool.

Kết quả: catalog và cấu hình web runtime chỉ đọc Supabase.

## 4. RAG bằng pgvector

- Đổi `src/agents/tools/rag.py`: query embedding dùng model của dataset; truy vấn DB thực hiện cosine, lọc dataset/category trước LIMIT và trả top-k tối đa 8.
- Bỏ tải toàn JSONL và vòng lặp cosine trên corpus trong runtime. Giữ output, giới hạn text, thứ tự score và fallback category hiện tại.
- Không thêm HNSW ở corpus nhỏ. Kiểm tra exact ranking/score so với phép cosine chuẩn trên fixture; kiểm tra filter và record có metadata khác nhau.
- Thiếu active dataset, sai model hoặc lỗi DB phải báo lỗi rõ; không fallback file hoặc trả dữ liệu giả.

Kết quả: RAG truy vấn trực tiếp pgvector với hợp đồng tool được giữ nguyên.

## 5. Cấu hình và hai guide

- Rà `.env.example`, `render.yaml`, Dockerfile, Compose, README và `supabase/README.md`; thống nhất tên biến provider/model/DB. Phân biệt khóa chat với khóa embedding OpenAI.
- Viết lại `docs/CLOUD_DEPLOYMENT.md`: DB đã chuẩn bị là điều kiện tiên quyết; từng bước Render backend, Vercel frontend, CORS, production domain, public access, smoke test và release/rollback code. Không có bước nạp dataset hoặc seed trong deploy.
- Tạo `docs/SUPABASE_DATA_IMPORT.md`: backup, migration DB mới/hiện có, file riêng, lệnh plan/apply/check, rollback dataset và phục hồi backup; giải thích nguồn catalog nghiệp vụ so với snapshot AI.
- README chỉ dẫn hai guide. Tìm các chỉ dẫn deploy cũ còn nhắc đưa dataset vào Git/image; sửa liên kết và chỉ dẫn có liên quan, tránh tạo thêm guide vận hành trùng lặp.
- Kiểm tra lệnh CLI bằng `--help`, biến môi trường với code, liên kết nội bộ và build context không chứa `dataset/`/`data/`.

Kết quả: người mới có thể deploy code và quản trị dữ liệu qua hai tài liệu riêng.

## 6. Kiểm chứng và chuyển DB thật

- Chạy test phù hợp: repository/import/RAG/catalog, `tests/test_db`, agent/API regression có liên quan; chạy lint trên file Python thay đổi và kiểm tra diff.
- Chạy backend khi không có thư mục dữ liệu để xác minh loại bỏ phụ thuộc filesystem. Build Docker nếu daemon khả dụng; nếu không, ghi rõ giới hạn và kiểm tra COPY/build context.
- Trên Supabase `ddkeoxomfypnoqdcxwxa`, lấy lịch sử migration, schema và fingerprint/số dòng bảng nghiệp vụ trước thay đổi. Áp dụng migration qua connector và đồng bộ version migration local với lịch sử thật.
- Chạy `plan` với nguồn riêng hiện có. Nếu nguồn hợp lệ, nạp snapshot bằng importer; giữ nguyên file gốc và các bảng nghiệp vụ. Nếu nguồn lỗi, dừng import và báo file/record cần sửa, không tự chỉnh nội dung crawl.
- Xác minh số dòng/digest AI, active version, vector query, grant/RLS, fingerprint nghiệp vụ trước/sau. Thử catalog và RAG; thử chat end-to-end khi credential provider cho phép.
- Báo kết quả thực tế và giới hạn kiểm chứng. Không công bố URL deploy mới nếu chưa thực sự deploy; tài liệu là đầu ra chính của quy trình public deployment trong phạm vi này.

## Tiêu chí kết thúc

Backend không đọc dataset/data local; Supabase chứa snapshot AI nhất quán; công cụ import lặp/rollback an toàn; dữ liệu nghiệp vụ và pipeline được bảo toàn; các kiểm tra liên quan đạt; hai guide khớp code và không yêu cầu public dữ liệu riêng. Các giới hạn môi trường phải được báo rõ, không thay bằng tuyên bố đã kiểm chứng.
