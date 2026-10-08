# Deploy AutoQuote AI để mọi người truy cập public

Luồng triển khai: **Vercel frontend → Render backend → Supabase PostgreSQL**. Người truy cập mở domain Production của Vercel. Máy cá nhân không cần chạy liên tục; frontend không giữ DB password hoặc AI key.

Quy trình này chỉ deploy code và kết nối DB đã chuẩn bị. File dữ liệu riêng được nạp từ máy quản trị theo [hướng dẫn nạp dữ liệu Supabase](SUPABASE_DATA_IMPORT.md), không đưa vào Git hoặc Docker image.

## 1. Chuẩn bị

- Repository trên GitHub, có `Dockerfile`, `render.yaml`, `requirements.txt`, `src/`, `frontend/`. Render/Vercel có quyền đọc repository; repository có thể private.
- Tài khoản Supabase, Render, Vercel và AI API key có quota.
- Supabase đã có schema nghiệp vụ và một snapshot AI active. Người quản trị chạy `python scripts/db/import_ai_data.py check` và xác nhận thành công trước khi deploy.
- Có URL PostgreSQL từ nút **Connect** trong Supabase. Chọn **Session pooler**, port `5432`, thích hợp khi host ứng dụng không hỗ trợ IPv6. Copy cả username/host từ dashboard, không đoán region hoặc project ref. URL-encode ký tự đặc biệt trong password, không encode toàn URL.

Giữ password/key trong môi trường quản trị hoặc dashboard backend. Kiểm tra `git ls-files dataset data`: kết quả phải rỗng. Docker build context đã loại cả hai thư mục.

**Đạt khi:** DB sẵn sàng, biết branch deploy và có connection string đúng. Nếu DB chưa sẵn sàng, hoàn tất guide dữ liệu trước; không chạy import trong build/start command của Render.

## 2. Tạo backend trên Render

Cấu hình Docker theo [tài liệu Render](https://render.com/docs/docker).

1. Mở Render Dashboard → **New → Web Service**, kết nối GitHub và chọn repository/branch.
2. Chọn runtime **Docker**, Root Directory để trống, Dockerfile Path `./Dockerfile`.
3. Chọn region gần Supabase; đặt Health Check Path `/health`. Chọn instance theo nhu cầu và chi phí hiện tại của tài khoản.
4. Trong Environment, nhập các biến dưới đây. Không đặt migration/admin URL ở Render nếu backend đã có `DATABASE_URL`.

| Biến | Giá trị |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_NAME` | `AutoQuote AI` |
| `DATABASE_URL` | `postgresql+asyncpg://<username>:<encoded-password>@<session-pooler-host>:5432/postgres` |
| `LLM_PROVIDER` | `openai` hoặc `google`; chọn rõ provider |
| `MODEL_NAME` | Model chat OpenAI tài khoản có quyền dùng, ví dụ `gpt-4o-mini` |
| `GOOGLE_MODEL_NAME` | Model chat Google tài khoản có quyền dùng, nếu chọn Google |
| `OPENAI_API_KEY` | Bắt buộc cho embedding RAG `text-embedding-3-small`, kể cả khi chat dùng Google |
| `GOOGLE_API_KEY` | Bắt buộc nếu chọn Google chat |
| `LLM_TEMPERATURE` | `0.0` |
| `CORS_ORIGINS` | Tạm `http://localhost:3000`; thay domain frontend ở bước 4 |
| `LOG_LEVEL` | `INFO` |

Không copy placeholder nguyên văn. Không thêm `/api/v1` vào URL DB hoặc backend. Render cấp `PORT`; Docker CMD tự đọc biến này.

5. Nhấn **Deploy Web Service**. Theo dõi log đến khi service Live; ghi URL, ví dụ `https://autoquote-api.onrender.com`.
6. Mở `<backend-url>/health`: phải trả `status: ok`. Mở `<backend-url>/docs` để kiểm tra Swagger.

Có thể dùng **New → Blueprint** với `render.yaml` thay cho tạo thủ công. Blueprint mặc định Google; điền Google model/key và OpenAI key cho RAG, hoặc đổi `LLM_PROVIDER=openai` và điền OpenAI model. Chỉ chọn một cách tạo để tránh service trùng.

**Đạt khi:** backend Live và health trả 200. Health chỉ xác nhận tiến trình chạy; chưa chứng minh dữ liệu/AI hoạt động.

## 3. Tạo frontend trên Vercel

1. Vercel Dashboard → **Add New → Project**, import cùng repository/branch.
2. Root Directory: `frontend`. Framework: Next.js. Install: `npm ci`; Build: `npm run build`; Output Directory giữ mặc định.
3. Environment Variables, scope **Production**: `BACKEND_URL=<backend-url>`, ví dụ `https://autoquote-api.onrender.com`. URL không có dấu `/` cuối và không có `/api/v1`.
4. Không nhập DB URL, Supabase secret/service key, OpenAI/Google key vào frontend. Không tạo `NEXT_PUBLIC_` biến cho các bí mật này.
5. Deploy; mở trang dự án và copy **Production domain**, ví dụ `https://autoquote-demo.vercel.app`.

Nếu đổi `BACKEND_URL`, redeploy frontend để release mới dùng cấu hình mới. Proxy Next.js tự thêm prefix API và gọi backend từ server.

**Đạt khi:** giao diện mở được trên Production domain.

## 4. Domain, CORS và quyền truy cập public

1. Render → Environment → đổi `CORS_ORIGINS` thành origin frontend, ví dụ `https://autoquote-demo.vercel.app`. Nếu có custom domain, thêm bằng dấu phẩy, không thêm path hoặc dấu `/` cuối. Lưu và chờ backend redeploy.
2. Vercel → Settings → [Deployment Protection](https://vercel.com/docs/deployment-protection): bảo đảm **Production domain** cho phép khách chưa đăng nhập Vercel. Preview có thể được bảo vệ; URL chia sẻ là Production domain.
3. Nếu dùng custom domain: thêm domain ở Vercel, cấu hình DNS đúng record dashboard cung cấp, chờ HTTPS hoạt động; sau đó cập nhật CORS.
4. Mở cửa sổ ẩn danh hoặc thiết bị khác chưa đăng nhập để kiểm tra.

Không cần cấp quyền `anon` cho các bảng Supabase. Browser truy cập backend/proxy; DB riêng được bảo vệ bằng credential server.

**Đạt khi:** người ngoài mở domain mà không gặp màn hình đăng nhập Vercel.

## 5. Kiểm tra toàn luồng trước khi chia sẻ

Thay `BACKEND_URL` bên dưới bằng URL service thực tế. Có thể dùng Swagger nếu không có curl.

```bash
curl -f https://BACKEND_URL/health
curl -f https://BACKEND_URL/api/v1/vehicles
curl -f -X POST https://BACKEND_URL/api/v1/chat -H "Content-Type: application/json" -d '{"message":"Giá VF 6 Plus theo catalog là bao nhiêu?"}'
```

Windows PowerShell:

```powershell
$backendUrl = "https://YOUR-BACKEND.onrender.com"
Invoke-RestMethod "$backendUrl/health"
Invoke-RestMethod "$backendUrl/api/v1/vehicles"
$chatBody = @{message="Giá VF 6 Plus theo catalog là bao nhiêu?"} | ConvertTo-Json
Invoke-RestMethod "$backendUrl/api/v1/chat" -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($chatBody))
```

Trên frontend, kiểm tra:

- Chọn xe/phiên bản/màu/tỉnh; catalog từ API có giá và màu đúng nguồn được quản trị chọn. Frontend có fallback nên nhìn thấy xe chưa chứng minh DB kết nối thành công: kiểm tra request catalog trong Network và API trực tiếp.
- Hỏi AI giá một phiên bản cụ thể, chi phí lăn bánh với tỉnh và số năm rõ ràng; rồi hỏi về pin/bảo hành để kích hoạt RAG. Không có lỗi thiếu dữ liệu hoặc embedding.
- Refresh và thử trong cửa sổ ẩn danh. Nếu API trả 503, xem mục lỗi và guide dữ liệu.

Catalog nghiệp vụ dùng `public`; AI dùng snapshot `ai_data`. Hai nguồn có thể khác ngày cập nhật. Xác minh phiên bản/nguồn trước khi so sánh; hệ thống không tự ghi đè giá/promo pipeline.

**Đạt khi:** API catalog, chat cấu trúc và RAG hoạt động; gửi Production URL của Vercel cho mọi người.

## 6. Vận hành và cập nhật

- Release code: chạy kiểm tra liên quan, push branch Render/Vercel theo dõi; chờ cả hai deploy thành công và lặp bước 5. Nếu chỉ đổi môi trường, restart/redeploy service tương ứng.
- Đổi model: sửa provider/model/key trên Render, redeploy; kiểm tra chat và RAG. Đổi model chat không đổi model embedding đã lưu.
- Đổi dữ liệu: thực hiện từ máy quản trị theo guide dữ liệu. Snapshot mới được ghim cho lượt AI tiếp theo; lượt đang chạy dùng snapshot cũ. Không rebuild image để cập nhật dữ liệu.
- Rollback code: dùng release đã chạy tốt trong Render và Vercel; giữ env tương thích. Rollback dữ liệu dùng `activate` trong guide riêng.
- Xem lỗi ở Render Logs và Vercel runtime logs, tránh ghi prompt có thông tin riêng, key hay password. Theo dõi quota AI và dung lượng DB.
- Instance có cơ chế sleep có thể chậm ở lần truy cập đầu; dùng gói phù hợp nếu cần phản hồi ổn định.

Dự án hiện phù hợp public demo: đăng nhập/dashboard còn mock, API ghi nghiệp vụ chưa có phân quyền đầy đủ, PDF là placeholder. Chỉ dùng thông tin demo khi chia sẻ public; các tính năng này chưa đủ cho vận hành giao dịch thực.

## Xử lý lỗi

| Triệu chứng | Kiểm tra và cách xử lý |
| --- | --- |
| Build backend lỗi | Dockerfile ở root, dependencies cài đủ; không thêm COPY dataset/data |
| Health 200 nhưng API DB lỗi | Kiểm tra connection string, password encoded, session pooler/port và schema đã chuẩn bị |
| Chat 503 hoặc tool báo thiếu dữ liệu | Quản trị chạy `import_ai_data.py check`, xác nhận active dataset và kết nối backend đúng DB |
| RAG lỗi nhưng catalog chạy | OPENAI_API_KEY/quota; dataset model phải `text-embedding-3-small`, 1536 chiều |
| Google/OpenAI báo model không tồn tại | Chọn model có quyền truy cập trên tài khoản; redeploy sau khi đổi env |
| Frontend 502/timeout | BACKEND_URL đúng origin service đang Live; xem Render log và service sleep |
| CORS | Origin phải chính xác HTTPS/domain/port, không path; redeploy backend |
| Người khác bị yêu cầu đăng nhập Vercel | Chia sẻ Production domain và kiểm tra Deployment Protection |
| Web lookup không khả dụng | Snapshot chưa có cấu hình web tùy chọn; không ảnh hưởng catalog/RAG |
| Giá chat khác configurator | Kiểm tra ngày cập nhật nguồn `ai_data` và `public`, không tự sửa giá để khớp |
