# Triển khai AutoQuote AI: Supabase + Render + Vercel

Hướng dẫn cho mã nguồn hiện tại: PostgreSQL trên Supabase, FastAPI/LangGraph trên Render, Next.js 16 trong `frontend/` trên Vercel. Domain, project ref, mật khẩu và key dưới đây là placeholder; lấy giá trị thực từ tài khoản triển khai.

```text
Browser → Vercel Next.js → Render FastAPI → Supabase PostgreSQL
                                  ├─ OpenAI / Google chat
                                  └─ Gold dataset + OpenAI Embeddings
```

## Cách sử dụng tài liệu

Deploy mới: chuẩn bị → Supabase → Render → Vercel → kiểm tra nghiệm thu. Deploy cập nhật: backup/kiểm kê/nâng cấp Supabase trước, rồi backend và frontend. Vận hành sau deploy theo [operations guide](OPERATIONS_GUIDE.md).

Lệnh terminal chạy từ thư mục gốc repository; Windows PowerShell dùng `curl.exe` thay `curl`. Người triển khai cần quyền trên repository và cả ba dịch vụ. Không cần dùng project/domain có sẵn của người viết.

## 1. Chuẩn bị

- Clone repository của bạn, checkout branch/commit sẽ deploy; ghi `git rev-parse HEAD`.
- Repository có `Dockerfile`, `render.yaml`, lockfile frontend và dữ liệu Gold.
- Nếu thao tác CLI local: Python 3.11+, Node.js 20.9+, PostgreSQL client; kiểm tra `python --version`, `node --version`, `psql --version`.
- Chuẩn bị hai môi trường staging/production khi nâng cấp database có dữ liệu.
- Supabase project, Render service, Vercel project thuộc tài khoản triển khai.
- Key provider chat và OpenAI key cho RAG, kể cả khi chọn Google chat.
- Model chat có quyền truy cập, cấu hình qua `MODEL_NAME` hoặc `GOOGLE_MODEL_NAME`.

Không đưa `.env`, mật khẩu database, key AI vào Git hay biến `NEXT_PUBLIC_*`. Script `scripts/db/migrate_supabase.py` đọc `MIGRATION_DATABASE_URL` hoặc `DATABASE_URL`, không còn thông tin kết nối hardcode. Nếu mật khẩu từng có trong phiên bản cũ còn sử dụng, đổi có kế hoạch và cập nhật các dịch vụ; xóa khỏi mã không xóa lịch sử Git.

Đăng nhập/dashboard frontend còn mock; xuất PDF chưa tạo file; API nghiệp vụ chưa có xác thực/phân quyền hoàn chỉnh. Bản triển khai phù hợp demo/kiểm thử; cần hoàn thiện các phần này trước khi tiếp nhận dữ liệu thật.

## 2. Supabase PostgreSQL: bước bắt buộc trước deploy backend

Thực hiện đầy đủ [Supabase database guide](SUPABASE_DATABASE_GUIDE.md). Tài liệu có lệnh cho Bash/PowerShell và SQL Editor, gồm:

1. Tạo project riêng, lấy direct/session pooler connection string.
2. Cài PostgreSQL client, kiểm tra đúng project và backup database hiện có.
3. Kiểm kê bảng/cột/enum; phân biệt database trống với database đã có dữ liệu.
4. Bootstrap DB trống bằng `python scripts/db/migrate_supabase.py bootstrap`; thêm `--seed` chỉ cho demo để có catalog và bộ buyer/chat/lead/quote/tồn kho liên kết. DB đã có catalog thì nạp mock riêng theo [mock data guide](MOCK_DATA_GUIDE.md), không chạy lại catalog seed.
5. Nâng cấp DB cũ bằng `python scripts/db/migrate_supabase.py upgrade`: hai cột ảnh/màu nóc, index, RLS và thu hồi public grants.
6. Kiểm tra schema, số dòng, bản giá trùng, ngày khuyến mãi, quyền/RLS.
7. Quy trình cập nhật giá thật và phục hồi khi lỗi.

Không bỏ qua bước database vì backend có `create_all()`: nó không ALTER bảng cũ và không seed. Không chạy lại seed để cập nhật: có thể tạo giá/khuyến mãi trùng và không ghi đè giá cũ.

Điều kiện để sang bước Render: script `check` exit 0, đủ cột `image_url` varchar(500)/`roof_hex` varchar(7), RLS bật, không có public grants, catalog có dữ liệu đã kiểm tra và backup sẵn sàng nếu nâng cấp. Seed demo chứa giá và ưu đãi 2025; cần dữ liệu được duyệt riêng để vận hành thật.

URL backend (khác URL CLI psql):

```dotenv
DATABASE_URL=postgresql+asyncpg://postgres.<project-ref>:<url-encoded-password>@<pooler-host>:5432/postgres
```

Dùng host/username thực từ Connect, không tự suy ra từ region. Kiểm tra kết nối theo [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

Quy trình database có sẵn:

```bash
python scripts/db/migrate_supabase.py check
python scripts/db/migrate_supabase.py upgrade
python scripts/db/migrate_supabase.py check
```

Chạy backup trước `upgrade`; lỗi SQL rollback và không tự seed. Migration version `20261008030728` đã được ghi nhận trên P097, runner bỏ qua nếu đã áp dụng. `MIGRATION_DATABASE_URL` chỉ cần ở máy quản trị, không phải biến bắt buộc trên Render. Browser không dùng Supabase Data API: bảng chỉ dành cho kết nối backend owner/admin, không có public RLS policies.


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

`BACKEND_URL` là biến server-side, không kèm `/api/v1`. `frontend/app/api/chat/route.ts` và `vehicles/route.ts` tự thêm prefix. Hai proxy này không dùng `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_BACKEND_URL`. Frontend không cần Supabase public key; database được truy cập qua backend.

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

## 7. Bàn giao và điều kiện nghiệm thu

Lưu thông tin bàn giao theo mục 1 operations guide: repository/commit, URL/project của ba dịch vụ, provider/model, phiên bản dữ liệu, backup và nơi quản lý secret. Không đưa secret vào tài liệu bàn giao công khai.

Chỉ xác nhận deploy hoàn tất khi catalog backend/proxy có dữ liệu, câu hỏi giá và kiến thức AI hoạt động, cấu hình mẫu có số tiền đối chiếu được, log không có lỗi database và schema đã kiểm tra. Không dùng giao diện fallback hoặc health OK làm bằng chứng database mới đã sẵn sàng.

Đối với release nâng cấp, giữ commit trước để rollback ứng dụng; giữ backup và SQL đã áp dụng. Quy trình rollback/backup và lỗi thường gặp nằm trong [operations guide](OPERATIONS_GUIDE.md).
