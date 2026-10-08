# Thiết kế chuyển dữ liệu AI sang Supabase

Ngày: 2026-10-08. Phạm vi đã thống nhất: chuyển backend AI sang Supabase và tách hướng dẫn deploy khỏi hướng dẫn nạp dữ liệu riêng.

## Mục tiêu và phạm vi

Bản deploy chạy từ mã nguồn công khai, không cần thư mục `dataset/` hoặc `data/` trong Git, Docker image hay máy chủ ứng dụng. Supabase lưu dữ liệu nghiệp vụ và dữ liệu phục vụ AI. Quản trị viên nạp dữ liệu nguồn từ máy riêng bằng công cụ độc lập với deploy.

Giữ nguyên nội dung được pipeline crawl, giá, promo, nguồn tham chiếu và embedding hiện có. Không tạo lại embedding, sửa giá, sửa ngày hiệu lực hay thay thế dữ liệu nghiệp vụ/mock đang tồn tại. Không thay đổi giao diện công khai của các tool AI hoặc công thức tính chi phí. Công việc này không bao gồm triển khai tài khoản cloud mới hay thay đổi hệ thống đăng nhập.

## Hiện trạng đã kiểm tra

- `vinfast_tools.py` đọc CSV từ Gold và có fallback thư mục local; `rag.py` đọc JSONL rồi tính cosine bằng Python.
- `web_lookup.py` còn đọc cấu hình nguồn web từ file riêng. Cấu hình này cũng phải chuyển sang DB để runtime không phụ thuộc dữ liệu local.
- Corpus hiện tại có 178 embedding, model `text-embedding-3-small`, 1536 chiều. Chọn pgvector để tìm kiếm trong PostgreSQL.
- Project Supabase hiện tại là `ddkeoxomfypnoqdcxwxa`. Extension vector 0.8.2 có sẵn nhưng chưa được cài; schema AI chưa tồn tại.
- API dùng SQLAlchemy async; tool LangGraph chạy đồng bộ trong worker thread. Không đưa async engine vào vòng lặp sự kiện tạo mới cho từng tool.

## Kiến trúc

Luồng nạp dữ liệu: máy quản trị → kiểm tra nguồn riêng → transaction PostgreSQL → kích hoạt phiên bản dữ liệu.

Luồng ứng dụng: backend → phiên bản AI đang hoạt động → catalog trong Supabase hoặc truy vấn pgvector. Trình duyệt gọi backend như hiện tại; không nhận DB credential hay dữ liệu embedding.

Một module repository đồng bộ dùng psycopg2 thực hiện truy vấn có tham số. Pool nhỏ, giới hạn số kết nối; mỗi lượt sử dụng trả kết nối trong `finally` và kết thúc transaction bằng rollback sau truy vấn chỉ đọc. Dùng `DATABASE_URL` hiện có, tương thích URL PostgreSQL/pooler; không yêu cầu Supabase service key ở frontend. Lỗi kết nối có timeout hữu hạn và trả lỗi có kiểm soát, không fallback sang file.

Mỗi lần gọi agent ghim một dataset ID trong phạm vi worker thread. Các tool trong cùng lần gọi dùng ID đó dù quản trị viên kích hoạt phiên bản mới giữa chừng. Cache catalog được khóa theo dataset ID, giới hạn hai phiên bản; không giữ cache nguồn cũ vô thời hạn. Lần gọi agent tiếp theo đọc lại phiên bản active từ DB.

## Schema riêng `ai_data`

Cài extension `vector` trong schema `extensions`. Migration tạo ba bảng:

| Bảng | Nội dung và ràng buộc |
| --- | --- |
| `datasets` | UUID, tên phiên bản, SHA-256 duy nhất của manifest nguồn, thời điểm tạo, model embedding, số chiều, thống kê số dòng JSONB, cấu hình web tùy chọn JSONB, cờ active. Unique partial index cho phép tối đa một phiên bản active. |
| `catalog_tables` | Khóa chính `(dataset_id, table_name)`, FK đến datasets, mảng dòng JSONB, số dòng và digest nội dung. Chỉ nhận tám tên bảng nguồn được liệt kê bên dưới; JSON phải là array. |
| `knowledge_records` | Khóa chính `(dataset_id, record_id)`, FK đến datasets, loại record, category, title, text, URL, doc ID, `extensions.vector(1536)` và JSONB record gốc. Index `(dataset_id, category)` hỗ trợ lọc. |

Tám nguồn catalog: `battery_rental_fees`, `cars_catalog`, `fee_rules`, `promotions`, `provinces`, `rolling_cost_matrix`, `trims_pricing`, `vehicle_colors`.

Giữ nguyên thứ tự dòng CSV và các giá trị dạng chuỗi để tool hiện tại tiếp tục diễn giải đúng. Record gốc bao gồm embedding JSON để bảo toàn độ chính xác nguồn; vector dùng tìm kiếm có thể có sai số float32, được kiểm tra theo dung sai. Schema này lưu snapshot AI, không ánh xạ mất thông tin vào các bảng nghiệp vụ `public`.

Không expose `ai_data` qua Data API. Revoke quyền schema/table của PUBLIC, anon và authenticated; bật RLS ở cả ba bảng. Backend/quản trị dùng credential server có quyền phù hợp. Không tạo RPC public hoặc hàm security-definer. Các bảng `public` hiện tại giữ nguyên dữ liệu, grant và policy.

## Tìm kiếm và cấu hình AI

Query vector lọc dataset và category trước khi xếp hạng/limit. Dùng cosine distance `<=>`, score `1 - distance`, top-k từ 1 đến 8. Với 178 record, dùng exact search để giữ recall đầy đủ; chưa thêm HNSW. Chỉ thêm approximate index khi số liệu đo thực tế chứng minh cần thiết.

Giữ nguyên output tool hiện tại, giới hạn text và fallback tìm toàn corpus khi category không có kết quả. Query embedding vẫn gọi OpenAI với model đã lưu của dataset. `LLM_PROVIDER`, model chat và khóa provider nằm trong `.env`; chọn Google cho chat vẫn cần OpenAI key cho embedding hiện tại. Model embedding không tự thay đổi theo model chat.

Các tool catalog lấy dữ liệu từ repository thay cho CSV. Provenance trả về tên schema/bảng và phiên bản Supabase. Công thức, lựa chọn trim/màu/province và điều kiện promotion giữ nguyên. Cấu hình web lấy từ dataset; thiếu cấu hình trả trạng thái không khả dụng rõ ràng. Giữ kiểm tra HTTPS, domain whitelist, redirect, timeout và giới hạn kích thước response.

## Công cụ nạp và rollback

Tạo `scripts/db/import_ai_data.py` với bốn lệnh:

- `plan`: đọc `--source-dir` chứa tám CSV trong `rdb_schema/` và `vinfast_embeddings.jsonl`; nhận thêm `--web-sources-file` tùy chọn. Kiểm tra rồi in số dòng/digest, không ghi DB.
- `apply`: kiểm tra lại nguồn và DB, nhập toàn bộ phiên bản và kích hoạt trong một transaction.
- `check`: đối chiếu phiên bản đã nhập với nguồn khi có `--source-dir`; nếu không có nguồn, kiểm tra trạng thái active, số dòng, ràng buộc và metadata model trong DB.
- `activate`: nhận dataset ID đã tồn tại, xác minh dữ liệu đủ trước khi kích hoạt; dùng để rollback phiên bản dữ liệu.

Manifest bao gồm digest từng file, phiên bản định dạng import và cấu hình web nếu có. Nạp lại cùng manifest không tạo bản sao hay ghi lại dữ liệu. Thay nguồn tạo phiên bản mới; giữ các phiên bản cũ để rollback. Không tự xóa phiên bản.

Importer kiểm tra header CSV, khóa tham chiếu car/trim/province cần cho tool, ID record duy nhất, model thống nhất, đủ 1536 giá trị hữu hạn và vector khác zero. Dữ liệu optional rỗng được xử lý theo hợp đồng tool hiện tại; không tự sửa record hỏng hoặc bỏ qua lỗi. Cấu hình web phải có domain/URL hợp lệ. Báo lỗi chỉ ra file/dòng/ID, không in bí mật kết nối hoặc toàn bộ embedding.

Advisory lock transaction tuần tự hóa import/activate. Chỉ chuyển active sau khi đủ catalog và knowledge, đối chiếu số dòng/digest và xác minh dữ liệu nghiệp vụ không bị thay đổi. Lỗi ở bất kỳ bước nào rollback toàn bộ. `apply` và `activate` đều thực hiện tắt active cũ trước khi bật active mới trong cùng transaction.

Catalog nghiệp vụ và snapshot AI là hai nguồn có thể khác thời điểm cập nhật. Việc chuyển nơi lưu không đồng nghĩa đồng bộ giá giữa hai nguồn; không tự ghi đè dữ liệu crawl để che giấu chênh lệch này. Guide giải thích cách kiểm tra phiên bản và cập nhật từ nguồn được quản trị viên chọn.

## Hai guide vận hành

`docs/CLOUD_DEPLOYMENT.md` là hướng dẫn đưa ứng dụng public: yêu cầu DB đã chuẩn bị, cấu hình backend Render/Docker, biến môi trường, frontend Vercel, CORS/domain, kiểm tra truy cập ẩn danh, cập nhật release và xử lý lỗi kết nối. Chỉ dẫn sang guide dữ liệu tại điều kiện tiên quyết; không yêu cầu upload dataset, seed hay chạy pipeline trong quy trình deploy.

`docs/SUPABASE_DATA_IMPORT.md` là hướng dẫn quản trị dữ liệu: backup, chọn DB mới hoặc DB hiện có, áp dụng migration, chuẩn bị file riêng, plan/apply/check, xác minh dữ liệu nghiệp vụ được giữ nguyên, kích hoạt phiên bản cũ và phục hồi backup. Phân biệt bootstrap schema với nạp dữ liệu; không bật seed/mock mặc định trên DB hiện có. Backup bao gồm `public`, `ai_data` và lịch sử migration.

README, `.env.example` và các tài liệu deploy liên quan trỏ về hai guide. `.dockerignore` loại toàn bộ `dataset/` và `data/`; Dockerfile chỉ copy code cần chạy. Không thêm dữ liệu riêng vào Git, file SQL migration, ví dụ hay fixture test.

## Kiểm chứng và tiêu chí hoàn thành

1. Test bằng fixture tổng hợp nhỏ: giữ nguyên kết quả catalog/tính giá/promotion và hợp đồng output RAG sau khi đổi repository.
2. Test importer: ID trùng, vector sai chiều/NaN/zero, nguồn thiếu, tham chiếu hỏng đều bị từ chối; import lặp không tăng số dòng; lỗi giữa transaction không đổi active.
3. Test pgvector bằng PostgreSQL có extension: thứ hạng/score gần với cosine hiện tại, filter trước limit, rollback activation và hai thao tác kích hoạt đồng thời.
4. Xác minh một lượt agent ghim cùng dataset; lượt sau nhìn thấy phiên bản mới. Test runtime không đọc file dữ liệu local.
5. Build/chạy backend không có hai thư mục dữ liệu. Kiểm tra chat catalog và RAG sau khi DB có dữ liệu; trường hợp DB trống báo thiếu dữ liệu có hướng xử lý, không trả dữ liệu giả.
6. Áp dụng migration và nạp nguồn riêng vào project đã xác định sau khi qua các bước review. So sánh fingerprint/số dòng các bảng nghiệp vụ trước/sau; kiểm tra counts/digests AI và quyền truy cập.
7. Hai guide có lệnh thực tế, tên biến môi trường khớp code và bước kiểm tra kết quả cho từng giai đoạn. Quy trình deploy không chứa bước đưa dataset lên repo/image.

## Rủi ro và vận hành

Supabase mất kết nối sẽ làm tool cần dữ liệu không khả dụng; ứng dụng báo lỗi rõ thay vì dùng cache không xác định phiên bản. Pooler phải hỗ trợ extension/vector qua truy vấn có tham số. Import cần quyền DDL khi migration và quyền ghi khi nạp; giữ credential trên máy quản trị/backend.

Phiên bản cũ tiêu tốn storage nhưng cho phép rollback an toàn. Hướng dẫn không xóa chúng tự động. Việc nạp riêng phải hoàn tất trước khi kiểm tra AI trên bản deploy. Health check HTTP hiện tại chỉ chứng minh tiến trình sống; guide dùng `check` và thử chat để chứng minh DB/AI hoạt động.
