# Đưa AutoQuote AI lên public — từng bước từ đầu đến URL chia sẻ

**Mục tiêu:** người khác mở một URL HTTPS để xem dự án, cấu hình xe và chat AI. Làm lần lượt bước 1–8 trong **file này**. Backup, mock data, cập nhật và xử lý lỗi cũng nằm cuối file; không cần đọc guide khác để deploy.

```text
Người truy cập → Vercel (Next.js + proxy /api)
                   → Render (FastAPI + AI)
                       → Supabase PostgreSQL
                       → OpenAI chat/embedding
                       → Gold CSV/corpus trong image backend
```

**URL gửi cho mọi người là domain Production của Vercel**, ví dụ `https://autoquote-demo.vercel.app`. Repository có thể private; website vẫn public. Không cần mua domain, mở port router hoặc chạy máy cá nhân liên tục. Database vẫn truy cập qua backend, không mở bảng Supabase cho browser.

Mã nguồn hiện phù hợp public demo: auth/dashboard còn mock, PDF chưa tạo file thật, chat runtime nằm trong bộ nhớ và API ghi nghiệp vụ chưa có phân quyền đầy đủ. Dùng dữ liệu giả để giới thiệu; chưa tiếp nhận thông tin khách hàng/giao dịch thật.

## Bước 1 — Chuẩn bị tài khoản và mã nguồn

1. Có tài khoản GitHub, Supabase, Render, Vercel. Render/Vercel được quyền đọc repository.
2. Có OpenAI API key và quota API. Luồng chính dùng OpenAI cho cả chat và RAG, chỉ cần một provider.
3. Trên máy quản trị: Git, Python 3.11+. Với DB có dữ liệu, cài PostgreSQL client `psql`, `pg_dump`, `pg_restore`. Node.js 20.9+ chỉ cần nếu build frontend trên máy; Vercel tự build khi deploy.
4. Mở terminal tại root repository, nơi có `Dockerfile`, `requirements.txt`, `src/`, `frontend/`.

```bash
git remote -v
git branch --show-current
git rev-parse HEAD
python --version
```

Ghi branch sẽ deploy. Placeholder host/domain/password bên dưới phải thay bằng thông tin thực của bạn.

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
# Không ghi đè .env đang có:
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Nếu PowerShell chặn activation, thay `python` bằng `.\.venv\Scripts\python.exe`; không cần đổi policy toàn máy. Nếu đã có virtual environment/dependencies, dùng môi trường đó.

Linux/macOS:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
test -f .env || cp .env.example .env
```

**Đạt khi:** repository có trên GitHub, biết branch và chạy được Python/dependencies.

## Bước 2 — Đưa dữ liệu AI cần thiết lên repository

Backend cần cả catalog Supabase và Gold trong Docker image. Chỉ có DB chưa đủ để AI hoạt động.

```text
dataset/gold/vinfast_embeddings.jsonl
dataset/gold/rdb_schema/battery_rental_fees.csv
dataset/gold/rdb_schema/cars_catalog.csv
dataset/gold/rdb_schema/fee_rules.csv
dataset/gold/rdb_schema/promotions.csv
dataset/gold/rdb_schema/provinces.csv
dataset/gold/rdb_schema/rolling_cost_matrix.csv
dataset/gold/rdb_schema/trims_pricing.csv
dataset/gold/rdb_schema/vehicle_colors.csv
```

`.gitignore` hiện bỏ qua `dataset/`, nhưng Dockerfile có `COPY dataset/`. **Các artifact này phải có trên branch remote để Render build được.** Dùng Gold đã có của dự án, không cần crawl lại để publish. Nếu bản clone thiếu file, lấy bộ artifact đã xuất/kiểm tra từ môi trường pipeline, đặt đúng đường dẫn trước khi tiếp tục. Pipeline hiện không tự tạo lại embedding corpus; JSONL không có vector không thay thế được file embedding.

Kiểm tra local, không gọi API AI:

```bash
python -c "from src.agents.tools.rag import _load_records; from src.agents.tools.vinfast_tools import _read_csv; print('RAG records:', len(_load_records())); print('Cars:', len(_read_csv('cars_catalog.csv'))); print('Prices:', len(_read_csv('trims_pricing.csv')))"
```

Phải có số dòng > 0, không lỗi thiếu file/model embedding. Corpus hiện dùng `text-embedding-3-small`.

Sau khi kiểm tra artifact không có secret/thông tin khách hàng, đưa **đúng** các file này vào Git:

```bash
git add -f dataset/gold/vinfast_embeddings.jsonl dataset/gold/rdb_schema/*.csv
git diff --cached --stat
```

Xem các thay đổi staged trước khi commit, nhất là khi còn thay đổi mã nguồn cần deploy:

```bash
git diff --cached
git commit -m "Include Gold artifacts for public deployment"
git push origin HEAD
git ls-files dataset/gold
```

Nếu artifact đã commit, kiểm tra chúng trên branch remote rồi tiếp tục. Không force-add toàn bộ `dataset/`; không commit `.env`, key hoặc backup DB. Khi Render/Vercel đã bật auto-deploy, push có thể kích hoạt deployment.

**Đạt khi:** GitHub có các artifact Gold trên branch sẽ deploy, không chỉ trên máy local.

## Bước 3 — Chuẩn bị Supabase

### 3.1. Chọn DB và lấy connection string

- **P097 hiện tại của bạn:** giữ project đang có; schema/mock đã sửa. Không bootstrap hoặc chạy lại catalog seed.
- **Người khác deploy:** Supabase Dashboard → **New project**, chọn region gần backend (luồng này dùng Singapore), đặt password và đợi project sẵn sàng.

Trong project → **Connect → Session pooler**, chọn port **5432**, copy connection string. Session pooler hỗ trợ IPv4 cho backend/máy quản trị. Copy đúng host/username từ Dashboard, không ghép host từ region. [Kết nối Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

Điền password vào URL; ký tự đặc biệt phải URL-encode. Để encode mà không gõ password vào lịch sử lệnh:

```bash
python -c "from getpass import getpass; from urllib.parse import quote; print(quote(getpass('DB password: '), safe=''))"
```

Nhập ẩn, lưu kết quả trong cấu hình private. Mở `.env` tại root, đặt:

```dotenv
DATABASE_URL=postgresql+asyncpg://postgres.<project-ref>:<encoded-password>@<session-pooler-host>:5432/postgres
MIGRATION_DATABASE_URL=postgresql://postgres.<project-ref>:<encoded-password>@<session-pooler-host>:5432/postgres
MIGRATION_SSLMODE=require
```

Hai URL cùng DB, khác prefix: backend dùng asyncpg/SQLAlchemy, runner quản trị dùng PostgreSQL URL. Không đặt DB URL trong frontend hoặc `NEXT_PUBLIC_*`.

### 3.2. Chạy đúng một nhánh

**A. DB đã có dữ liệu, bao gồm P097:** backup theo phần A cuối file, rồi chạy:

```bash
python scripts/db/migrate_supabase.py check
python scripts/db/migrate_supabase.py upgrade
python scripts/db/migrate_supabase.py check
python scripts/db/mock_data.py check
```

Check đầu có thể exit 1 nếu schema cũ; đọc báo cáo trước upgrade. Upgrade chỉ chạy migration còn thiếu, không seed lại, không đổi giá/promo. Nếu mock chưa đạt, dùng phần B cuối file sau khi xác định dữ liệu nào là giả.

**B. DB mới, chưa có bảng ứng dụng:** tạo catalog và bộ nghiệp vụ demo:

```bash
python scripts/db/migrate_supabase.py bootstrap --seed
python scripts/db/migrate_supabase.py check
python scripts/db/mock_data.py check
```

Bootstrap chỉ dành cho DB trống, tạo schema/catalog/buyer/chat/lead/quote/tồn kho trong transaction. Catalog seed là snapshot demo năm 2025. Không bootstrap P097 đang có dữ liệu pipeline. Thư mục migration chưa có baseline đầy đủ nên không dùng riêng `supabase db push` để dựng DB mới.

### 3.3. Xác nhận DB sẵn sàng

Schema check phải exit 0: đủ cột/index bắt buộc, RLS bật, không có grants PUBLIC/anon/authenticated. Với DB demo, mock check phải có dữ liệu và 0 lỗi.

Supabase SQL Editor, kiểm tra chỉ đọc:

```sql
SELECT 'vehicle_prices' AS table_name, count(*) FROM public.vehicle_prices
UNION ALL SELECT 'promotions', count(*) FROM public.promotions
UNION ALL SELECT 'users', count(*) FROM public.users
UNION ALL SELECT 'chat_sessions', count(*) FROM public.chat_sessions
UNION ALL SELECT 'leads', count(*) FROM public.leads
UNION ALL SELECT 'quotes', count(*) FROM public.quotes
UNION ALL SELECT 'inventory', count(*) FROM public.inventory;
```

P097 sau lần sửa ngày 08/10/2026: 52 giá xe, 14 promos, 55 users, 42 chats, 42 leads, 31 quotes, 312 inventory. Project mới có thể khác; không ép số lượng giống P097.

**Đạt khi:** đúng project, schema đạt, catalog có dữ liệu. Public website không yêu cầu tắt RLS hoặc mở quyền bảng cho anon.

## Bước 4 — Deploy backend trên Render

Luồng chính dùng **Web Service / Docker** để điền rõ từng cấu hình. `render.yaml` là phương án Blueprint có sẵn; không tạo cả hai vì sẽ thành hai backend riêng.

1. Render Dashboard → **New → Web Service**.
2. Kết nối GitHub, chọn repository và branch đã push ở bước 2.
3. Điền:

| Trường | Giá trị |
| --- | --- |
| Name | Tên bạn chọn, ví dụ `autoquote-backend` |
| Region | Singapore |
| Language / Runtime | Docker |
| Root Directory | Để trống, dùng root repository |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context | Root repository nếu có trường này |
| Docker Command | Để trống, dùng CMD có sẵn |
| Health Check Path | `/health` |
| Instance Type | Free cho demo; paid nếu cần luôn sẵn sàng |

Dockerfile đã bind `0.0.0.0` và dùng `PORT` do Render cấp. Không đặt port cố định; build command nằm trong Dockerfile. [Deploy Render](https://render.com/docs/deploys).

4. Thêm **Environment Variables** trước khi tạo service:

| Key | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_NAME` | `AutoQuote AI` |
| `DATABASE_URL` | URL asyncpg từ bước 3 |
| `LLM_PROVIDER` | `openai` |
| `OPENAI_API_KEY` | Key OpenAI của bạn |
| `MODEL_NAME` | `gpt-4o-mini`, hoặc model chat bạn có quyền dùng |
| `LLM_TEMPERATURE` | `0.0` |
| `CORS_ORIGINS` | Tạm `http://localhost:3000`, đổi ở bước 6 |
| `LANGCHAIN_TRACING_V2` | `false` |

Không cần Google key cho luồng này. `MIGRATION_DATABASE_URL` chỉ cần trên máy quản trị. Không đưa `.env` lên Git.

5. **Create Web Service**, đợi build và trạng thái **Live**. Nếu lỗi, mở logs và phần D cuối file.
6. Copy HTTPS Render cấp, ví dụ `https://autoquote-backend.onrender.com`; đây là **BACKEND_URL**.
7. Mở:

```text
https://<backend-service>.onrender.com/health
https://<backend-service>.onrender.com/api/v1/vehicles
```

Health phải trả `status=ok`, `env=production`. Vehicles phải trả JSON catalog không rỗng. Health riêng lẻ không chứng minh DB kết nối được.

Render Free có thể ngủ sau 15 phút không có traffic; request tiếp theo cần chờ khởi động. Trước khi trình diễn, mở backend health để đánh thức service. Nếu cần phản hồi ổn định ngay lúc truy cập, chọn instance luôn chạy. [Giới hạn Free](https://render.com/docs/free).

**Đạt khi:** HTTPS backend hoạt động và catalog trả dữ liệu.

## Bước 5 — Deploy frontend trên Vercel

1. Vercel Dashboard → **Add New → Project**, import cùng repository.
2. Điền:

| Trường | Giá trị |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `frontend` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Giữ mặc định Next.js, không đặt `out` |

Frontend có server routes `/api/chat`, `/api/vehicles`, cần Next.js deployment đầy đủ. [Cấu hình build Vercel](https://vercel.com/docs/builds/configure-a-build).

3. Thêm Environment Variable cho **Production** và Preview nếu cần test:

```dotenv
BACKEND_URL=https://<backend-service>.onrender.com
```

Dùng URL thực từ bước 4, **không kèm `/api/v1` hay dấu `/` cuối**; proxy tự thêm prefix. Frontend không cần DB password, AI key, Supabase public key hoặc `NEXT_PUBLIC_BACKEND_URL`.

4. **Deploy**, đợi **Ready**.
5. Project → **Settings → Git**, kiểm tra **Production Branch** đúng branch triển khai. Nếu deployment là Preview, deploy/promote phiên bản đó thành Production.
6. Trong **Domains**, copy domain Production ổn định, ví dụ `https://autoquote-demo.vercel.app`; đây là **FRONTEND_URL**. Chưa cần custom domain.

**Đạt khi:** website có domain Production và trỏ đúng backend.

## Bước 6 — Đảm bảo ai cũng truy cập được

1. Vercel project → **Settings → Deployment Protection**.
2. Chọn **Standard Protection**: preview được bảo vệ, domain Production public. Không chọn **All Deployments** nếu muốn mọi người vào domain Production. [Deployment Protection](https://vercel.com/docs/deployment-protection).
3. Chia sẻ domain Production ở **Domains**, không dùng URL preview hoặc URL riêng của deployment có protection.
4. Render → **Environment**, sửa và save/redeploy:

```dotenv
CORS_ORIGINS=https://<production-frontend-domain>
```

Origin không có path/dấu slash cuối. Khi thêm custom domain, ngăn cách origins bằng dấu phẩy, không thêm khoảng trắng.

5. Mở FRONTEND_URL trong cửa sổ **Incognito/Ẩn danh**, thử điện thoại ở mạng khác hoặc nhờ người không đăng nhập Vercel thử.
6. Người đó phải mở trang/chat mà không cần tài khoản Vercel. Trang đăng nhập demo bên trong ứng dụng là chức năng riêng của dự án.

**Đạt khi:** người không có tài khoản hosting vẫn truy cập được. Tắt máy của bạn không làm website ngừng hoạt động.

## Bước 7 — Kiểm tra toàn bộ luồng public

| Kiểm tra | Phải đạt |
| --- | --- |
| `BACKEND_URL/health` | `status=ok`, `env=production` |
| `BACKEND_URL/api/v1/vehicles` | Catalog có xe/phiên bản/màu/giá |
| `FRONTEND_URL/api/vehicles` | HTTP 200, cùng catalog backend |
| FRONTEND_URL bằng ẩn danh | Không yêu cầu login Vercel |
| Configurator | Chọn xe, cấu hình, thấy giá/phí |
| Chat “VF 6 có những phiên bản và màu nào?” | Dùng catalog Gold, không thiếu CSV |
| Chat “Bảo hành pin và cách sạc tại nhà như thế nào?” | Có kiến thức Gold, không lỗi embedding/key |

UI có fallback nên không dùng riêng việc nhìn thấy xe để kết luận DB chạy. Dashboard vẫn mock riêng và PDF vẫn placeholder.

PowerShell, thay URL thực:

```powershell
$backendUrl = 'https://<backend-service>.onrender.com'
$frontendUrl = 'https://<production-frontend-domain>'
Invoke-RestMethod "$backendUrl/health"
Invoke-RestMethod "$backendUrl/api/v1/vehicles"
Invoke-RestMethod "$frontendUrl/api/vehicles"
$body = @{ message = 'VF 6 có những phiên bản và màu nào?' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$frontendUrl/api/chat" -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

Linux/macOS có thể mở URL/call bằng curl; Windows dùng `curl.exe` nếu muốn. Ghi endpoint/status/lỗi rút gọn khi chẩn đoán, không chia sẻ toàn bộ env.

**Đạt khi:** người dùng public mở được trang, catalog/proxy/AI đều chạy. Đây mới là điều kiện hoàn thành deploy demo.

## Bước 8 — Lưu thông tin để vận hành

Lưu trong hồ sơ private: repository/branch/commit live, FRONTEND_URL, BACKEND_URL, Supabase project ref/connection settings, provider/model, nơi giữ secret, phiên bản dữ liệu Gold/DB, migration và backup gần nhất.

Gửi **FRONTEND_URL** cho người xem. Không gửi `.env`, DB password, AI key hay quyền quản trị.

---

## A. Backup và phục hồi

PostgreSQL client cùng hoặc mới hơn major server. Backup `public` và lịch sử migration; không bao gồm Supabase Auth/file Storage. Lấy settings thực từ Connect.

PowerShell:

```powershell
$env:PGHOST = '<session-pooler-host>'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = 'postgres.<project-ref>'
$env:PGSSLMODE = 'require'
pg_dump -W --format=custom --schema=public --schema=supabase_migrations --no-owner --no-acl --file=before-deploy.dump
pg_restore --list before-deploy.dump
```

Bash dùng `export PGHOST='...'`, `export PGPORT='5432'`, `export PGDATABASE='postgres'`, `export PGUSER='postgres.<project-ref>'`, `export PGSSLMODE='require'`, rồi cùng lệnh dump/list. `-W` hỏi password gốc, không phải password đã URL-encode.

Lưu dump ngoài Git, ghi thời điểm/project/commit. Thử restore vào **project test mới chưa bootstrap**, đổi PG env sang đúng project test:

```bash
pg_restore -W --exit-on-error --no-owner --no-acl --dbname=postgres before-deploy.dump
```

`--no-acl` không giữ grants. Trước khi dùng DB test, chạy lại SQL trong `supabase/migrations/20261008030728_harden_autoquote_database.sql` và `20261008034446_add_demo_chat_sessions.sql` trong transaction `BEGIN; ... COMMIT;` bằng SQL Editor để thu hồi quyền browser. Không chạy catalog seed. Trỏ `.env` quản trị sang DB test, chạy schema/mock check và đối chiếu số dòng. Không restore chồng vào P097/DB có dữ liệu để chữa lỗi deploy.

## B. Mock data thống nhất, giữ nguyên dữ liệu pipeline

P097 hiện tại không cần làm phần này nếu check bước 3 đạt. Script chỉ ghi users demo thiếu/chat/leads/quotes/inventory; giữ nguyên giá xe/pin/phụ kiện/phí/promo/đại lý và users đã tồn tại. Khi adoption, giữ ID lead/quote, không xóa dòng. Buyer ở `public.users` không phải Supabase Auth; password accounts demo mới bị vô hiệu hóa.

DB có catalog nhưng chưa có nghiệp vụ, hoặc bộ mock đã đánh dấu:

```bash
python scripts/db/mock_data.py plan --as-of 2026-10-08T00:00:00
python scripts/db/mock_data.py apply --as-of 2026-10-08T00:00:00 --expected-plan-sha256 '<hash-trong-ket-qua-plan>'
python scripts/db/mock_data.py check
```

Chọn mốc UTC phù hợp catalog, cùng mốc ở plan/apply. Hash khiến apply dừng nếu dữ liệu đổi sau plan. Cùng mốc/dữ liệu tạo cùng ID/nội dung, không sinh trùng.

Nếu **tất cả leads/quotes cũ đã xác nhận là giả**, backup rồi thêm `--adopt-existing-mock` vào cả plan/apply. Không dùng trên DB lẫn khách hàng thật. Chat/inventory chưa đánh dấu vẫn khiến script dừng để xử lý riêng, không tự gắn dấu mock vào dòng chưa rõ nguồn.

Transaction ghi/kiểm tra rollback toàn bộ khi lỗi; catalog khóa ngắn trong lúc ghi, lock timeout 5s/statement timeout 60s. Check in số dòng và 7 nhóm lỗi: buyer/chat/lead, seller/đại lý, chuỗi quote, phép tính giá, thời gian/trạng thái, inventory/catalog/warehouse, session trùng. Cần dữ liệu và 0 lỗi; DB rỗng 0 lỗi chưa có nghĩa đã nạp demo.

Mock bao phủ các trạng thái quote/lead. Snapshot theo phép tính API hiện tại; API promo chưa diễn giải conditions/dealer_id. Buyer liên kết qua JSON chat được script kiểm tra, không phải khóa ngoại mới. Runtime dùng MemorySaver chưa ghi chat_sessions; API tạo lead/quote cũng chưa tự bảo đảm toàn bộ chuỗi này cho dữ liệu phát sinh. Frontend dashboard dùng mock riêng.

## C. Cập nhật và rollback

1. Ghi commit live, backup trước khi đổi DB.
2. Chạy migration upgrade/check trước code cần schema mới; kiểm soát auto-deploy nếu cần đúng thứ tự.
3. Push code/artifact đã kiểm tra lên branch Production, theo dõi Render Deploys/Vercel Deployments.
4. Đổi env thì redeploy; settings/client/corpus được cache trong tiến trình.
5. Chạy lại bước 7.

Đổi OpenAI chat qua `MODEL_NAME`. Google chat: đặt `LLM_PROVIDER=google`, `GOOGLE_API_KEY`, `GOOGLE_MODEL_NAME` có quyền truy cập; vẫn cần OpenAI key cho RAG. Blueprint `render.yaml` mặc định google, nên điền Google model/key hoặc đổi provider tương ứng nếu chọn phương án đó.

Pipeline Gold không tự ghi bảng giá nghiệp vụ Supabase hoặc tái tạo embedding. Khi cập nhật giá/knowledge, quản lý phiên bản PostgreSQL, Gold CSV, corpus embedding và giá frontend; đối chiếu cấu hình mẫu qua API/chat/UI. Không chạy lại seed, gia hạn promo hay sửa dữ liệu crawler để qua test. Cập nhật artifact rồi rebuild backend.

Rollback code: Render deploy commit tốt cũ; Vercel restore deployment tốt tương ứng, kiểm tra env. Rollback code không rollback DB; giữ schema tương thích hoặc phục hồi có kế hoạch từ backup đã thử. Không DROP/reset DB để chữa build.

## D. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| Render thiếu dataset | Gold chưa trên GitHub/branch deploy; làm lại bước 2 |
| Render không Live / sai port | Docker, root trống, command mặc định; app bind `0.0.0.0:$PORT` |
| Health OK, vehicles lỗi | DB URL/session pooler/password encode, schema check, DB runtime logs |
| Tenant or user not found | Copy đúng username/host từ Supabase Connect |
| Timeout DB | Project active, Session pooler 5432 cho IPv4, password/network restrictions |
| Chat lỗi model/key/quota | Render env, quyền model/quota API, redeploy |
| Chat lỗi embedding | OpenAI key/quota và corpus Gold đúng model trong image |
| Vercel thiếu package.json | Root frontend, Next.js, npm ci và lockfile trên branch deploy |
| Vercel /api/vehicles lỗi | BACKEND_URL đúng HTTPS, không prefix/slash cuối; redeploy frontend |
| Người khác phải login Vercel | Domain Production trong Domains, Standard Protection, thử ẩn danh |
| Chat lần đầu chậm | Đánh thức Render Free qua health, đợi Live rồi thử lại |
| Dashboard khác DB | Dashboard mock; đối chiếu SQL/API |
| Mất chat sau restart | MemorySaver chưa có checkpoint bền vững |
| PDF link không tải | Chưa có PDF generator, không phải lỗi hosting |

Cấu hình hosting được đối chiếu tài liệu chính thức ngày 08/10/2026. Nếu Dashboard đổi tên trường, giữ đúng ý nghĩa cấu hình và kết quả kiểm tra mỗi bước.
