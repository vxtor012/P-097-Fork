# Triển khai AutoQuote AI: Supabase + Render + Vercel

Hướng dẫn cho mã nguồn hiện tại: PostgreSQL trên Supabase, FastAPI/LangGraph trên Render, Next.js 16 trong `frontend/` trên Vercel. Domain, project ref, mật khẩu và key dưới đây là placeholder; lấy giá trị thực từ tài khoản triển khai.

```text
Browser → Vercel Next.js → Render FastAPI → Supabase PostgreSQL
                                  ├─ OpenAI / Google chat
                                  └─ Gold dataset + OpenAI Embeddings
```

## 1. Chuẩn bị

- Repository có `Dockerfile`, `render.yaml`, lockfile frontend và dữ liệu Gold.
- Supabase project, Render service, Vercel project thuộc tài khoản triển khai.
- Key provider chat và OpenAI key cho RAG, kể cả khi chọn Google chat.
- Model chat có quyền truy cập, cấu hình qua `MODEL_NAME` hoặc `GOOGLE_MODEL_NAME`.

Không đưa `.env`, mật khẩu database, key AI vào Git hay biến `NEXT_PUBLIC_*`. Tài liệu cũ và `scripts/db/migrate_supabase.py` có URL kết nối hardcode; script này chưa đọc `DATABASE_URL`, không dùng để khởi tạo project mới. Nếu mật khẩu cũ còn sử dụng, cần đổi vì xóa khỏi tài liệu không xóa lịch sử Git.

Đăng nhập/dashboard frontend còn mock; xuất PDF chưa tạo file; API nghiệp vụ chưa có xác thực/phân quyền hoàn chỉnh. Bản triển khai phù hợp demo/kiểm thử; cần hoàn thiện các phần này trước khi tiếp nhận dữ liệu thật.

## 2. Supabase PostgreSQL

Mở project → **Connect**, sao chép connection string. Backend chạy lâu dài có thể dùng direct connection nếu mạng hỗ trợ hoặc **Session pooler** cho IPv4. Xem [Supabase: kết nối PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres).

Ví dụ URL backend qua session pooler:

```dotenv
DATABASE_URL=postgresql+asyncpg://postgres.<project-ref>:<url-encoded-password>@<pooler-host>:5432/postgres
```

Lấy host/username từ Dashboard, không tự ghép host theo region. URL-encode ký tự đặc biệt trong mật khẩu. `src/db.py` tự đổi prefix `postgresql://`/`postgres://` sang `postgresql+asyncpg://`.

Nếu dùng transaction pooler cổng 6543, backend hiện đặt `statement_cache_size=0`, `prepared_statement_cache_size=0` khi nhận diện Supabase/pooler URL. Vẫn cần kiểm tra driver/chế độ pooler thực tế nếu xuất hiện lỗi prepared statement.

### Khởi tạo database demo mới

Chạy `scripts/db/schema.sql`, rồi `scripts/db/seed.sql` qua SQL Editor. Đọc và kiểm tra trước khi chạy: seed là dữ liệu mẫu. Schema có `CREATE TYPE` nên không chạy lại toàn bộ trên database đã khởi tạo; database có dữ liệu cần migration được kiểm tra riêng.

Backend gọi `create_all` nhưng không tự nạp seed. Kiểm tra catalog bằng `/api/v1/vehicles`; `/health` không kiểm tra database. Chat dùng catalog Gold CSV, không tự nhận thay đổi giá trong PostgreSQL.

## 3. Backend Render

### Blueprint

1. Đẩy phiên bản cần triển khai lên repository.
2. Render Dashboard → **New Blueprint**, chọn repository và branch.
3. Render đọc `render.yaml` tại thư mục gốc, build Dockerfile, health check `/health`.
4. Điền biến `sync: false`, kiểm tra provider/model trong Environment.

Blueprint đặt `APP_ENV=production`, `LLM_PROVIDER=google`, region Singapore, plan `free`. Điều chỉnh plan theo nhu cầu. Tham khảo [Render Blueprint reference](https://render.com/docs/blueprint-spec).

### Web Service thủ công

Chọn runtime **Docker**, Dockerfile `./Dockerfile`, build context thư mục gốc, health check `/health`. Không đặt root directory thành `frontend`. Docker CMD bind `0.0.0.0`, dùng `${PORT:-8000}`; Render cung cấp `PORT`.

| Biến | Giá trị / mục đích |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_NAME` | `AutoQuote AI` |
| `DATABASE_URL` | Connection string database của bạn |
| `LLM_PROVIDER` | `google` hoặc `openai`; nên chọn rõ khi có cả hai key |
| `MODEL_NAME` | OpenAI chat, ví dụ `gpt-4o-mini` |
| `GOOGLE_MODEL_NAME` | Model Google chat có quyền truy cập |
| `LLM_TEMPERATURE` | `0.0` |
| `OPENAI_API_KEY` | Key RAG và OpenAI chat nếu chọn OpenAI |
| `GOOGLE_API_KEY` | Key Google nếu chọn Google chat |
| `CORS_ORIGINS` | Ví dụ `https://<frontend-domain>` |

CORS origin không kèm `/api/v1` hoặc dấu `/` cuối; không dùng `*` khi middleware bật credentials. Proxy Next.js gọi server-to-server không chịu CORS; CORS áp dụng khi browser gọi trực tiếp backend.

`auto` ưu tiên OpenAI rồi Google theo kiểm tra key sơ bộ, không chuyển provider khi API lỗi. Dùng `google` rõ ràng khi OpenAI key chỉ phục vụ RAG. Restart/redeploy sau khi đổi biến vì settings/client được cache. Model chat đổi qua environment, không cần sửa Python.

Docker image chứa `src/`, `dataset/`; cần `dataset/gold/vinfast_embeddings.jsonl` và `dataset/gold/rdb_schema/`. RAG không dùng ChromaDB/Pinecone. Các tài nguyên fallback trong `data/vinfast_agent` không được Dockerfile copy; kiểm thử riêng web lookup nếu cần luồng này.

Lưu URL thực tế Render cấp, ví dụ `https://<backend-service>.onrender.com`.

## 4. Frontend Vercel

1. Import repository; **Root Directory** = `frontend`, framework **Next.js**.
2. Build bằng `npm run build`, cài dependencies từ lockfile bằng `npm ci`.
3. Đặt biến sau cho Production; nếu dùng Preview, đặt backend phù hợp cho Preview.

```dotenv
BACKEND_URL=https://<backend-service>.onrender.com
```

`BACKEND_URL` là biến server-side, không kèm `/api/v1`. `frontend/app/api/chat/route.ts` và `vehicles/route.ts` tự thêm prefix. Hai proxy này không dùng `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_BACKEND_URL`. Biến Supabase public trong mẫu frontend chưa nối vào luồng hiện tại; database được truy cập qua backend.

Deploy và lưu domain thực tế. Đổi biến môi trường cần deployment mới theo [Vercel environment variables](https://vercel.com/docs/environment-variables). Cập nhật `CORS_ORIGINS` trên Render bằng origin frontend rồi redeploy backend.

## 5. Kiểm tra sau triển khai

Thay placeholder bằng domain thực tế:

```bash
curl https://<backend-service>.onrender.com/health
curl https://<backend-service>.onrender.com/api/v1/vehicles
curl https://<frontend-domain>/api/vehicles
```

- Health trả `status=ok`, `env=production`: chỉ là liveness; startup có thể bắt lỗi database rồi tiếp tục chạy.
- `/docs` mở Swagger; `/api/v1/vehicles` trả catalog đã seed để kiểm tra database.
- `/api/vehicles` trên Vercel trả catalog để kiểm tra proxy và `BACKEND_URL`.
- Mở configurator, chọn xe, chat hỏi giá/phí để kiểm tra công cụ cấu trúc.
- Chat hỏi kiến thức sạc/bảo hành để kiểm tra RAG; xem log để xác nhận không có lỗi embedding.
- Dashboard vẫn là mock; URL PDF placeholder không chứng minh xuất PDF thành công.

## 6. Xử lý lỗi và vận hành

| Triệu chứng | Kiểm tra |
| --- | --- |
| Health OK, catalog lỗi | Database URL, kết nối/pooler, schema/seed, log startup |
| Chat lỗi key/model | Provider, tên model, quyền truy cập, quota tài khoản |
| Gemini chat được, RAG lỗi | OpenAI key và corpus Gold; embedding cố định `text-embedding-3-small` |
| Proxy Vercel lỗi | Backend URL không kèm prefix, backend truy cập được, deployment đã nhận biến mới |
| Prepared statement lỗi | Chế độ pooler, cấu hình cache `src/db.py`, driver đang cài |
| Giá chat khác configurator | Gold CSV, PostgreSQL và dữ liệu/phí local frontend chưa đồng bộ |

LangGraph checkpoint ở bộ nhớ tiến trình: restart mất hội thoại, các instance không chia sẻ trạng thái. Pool backend hiện có `10` kết nối và tối đa `20` kết nối vượt pool mỗi tiến trình; cân đối số instance với giới hạn database. Không dùng filesystem container làm nơi lưu dữ liệu bền vững.
