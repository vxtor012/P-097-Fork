# AutoQuote AI — Cấu hình xe và tư vấn báo giá VinFast

Ứng dụng hỗ trợ chọn dòng xe, phiên bản, màu sắc, pin, phụ kiện và tỉnh/thành đăng ký; xem dự toán chi phí lăn bánh và trao đổi với AI bằng tiếng Việt. Backend cung cấp API dữ liệu xe, báo giá, khuyến mãi, khách hàng tiềm năng và tồn kho.

## Chức năng và trạng thái

| Chức năng | Triển khai hiện tại |
| --- | --- |
| Configurator | Chọn cấu hình, xem xe 3D, dự toán; tải catalog qua `/api/vehicles`, có dữ liệu dự phòng frontend |
| Chat AI | Proxy Next.js gọi FastAPI; LangGraph điều phối hội thoại và công cụ |
| Giá, phí, ưu đãi trong chat | Công cụ Python đọc snapshot catalog riêng trong Supabase `ai_data` |
| RAG | Tìm kiếm cosine bằng pgvector trên Supabase; OpenAI embedding câu hỏi |
| API nghiệp vụ | PostgreSQL lưu giá xe, pin, phụ kiện, phí, khuyến mãi, leads, báo giá và tồn kho |
| Duyệt báo giá | Backend cập nhật trạng thái duyệt/từ chối; frontend vẫn dùng mock |
| Đăng nhập và dashboard | Đăng nhập demo và dữ liệu mock; chưa có xác thực backend hoàn chỉnh |
| Xuất PDF | Endpoint placeholder trả URL; chưa tạo PDF thực tế |

Configurator tính dự toán ở client. Chat đọc snapshot AI và API nghiệp vụ đọc bảng `public` trên cùng PostgreSQL. Hai nguồn có thể khác thời điểm cập nhật; quản trị viên kiểm tra nguồn trước khi thay bảng giá. Dữ liệu riêng không cần public vào repository.

## Kiến trúc

```text
Browser → Next.js → proxy API → FastAPI
                                ├─ LangGraph → OpenAI / Google chat
                                │              ├─ Supabase ai_data catalog
                                │              └─ Supabase pgvector + OpenAI Embeddings
                                └─ SQLAlchemy async → PostgreSQL
```

- Backend: Python 3.11+, FastAPI, Pydantic Settings, LangGraph/LangChain, SQLAlchemy, asyncpg.
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, TanStack Query, Three.js.
- Pipeline: crawl HTML/API/PDF → Bronze → chuẩn hóa tiếng Việt, chia chunk Silver → lọc và deduplicate Gold.
- Triển khai: Docker Compose local; Supabase PostgreSQL, Render backend, Vercel frontend.

## Chạy local

Yêu cầu Python 3.11+, Node.js 20.9+ và Docker Compose để khởi tạo PostgreSQL. Chạy backend từ thư mục gốc repository.

### Backend và database

```bash
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cp .env.example .env
# PowerShell: Copy-Item .env.example .env
docker compose up -d postgres
```

Điền key, chọn provider/model trong `.env`. URL database mẫu kết nối PostgreSQL local cổng 5432. Compose tạo schema/catalog demo local khi tạo volume lần đầu. Để dùng dữ liệu riêng, kết nối Supabase và chuẩn bị schema/dữ liệu theo [guide nạp dữ liệu](docs/SUPABASE_DATA_IMPORT.md). Backend không tự import snapshot AI; SQLite không được hỗ trợ.

```bash
python scripts/db/migrate_supabase.py upgrade
# Chuẩn bị dữ liệu AI theo docs/SUPABASE_DATA_IMPORT.md trước khi thử chat.
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Mở [health](http://localhost:8000/health) và [Swagger](http://localhost:8000/docs). Health chỉ phản ánh ứng dụng chạy, không xác nhận database hoặc AI hoạt động.

### Frontend

Trong terminal riêng:

```bash
cd frontend
npm ci
cp .env.example .env.local
# PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Đặt `BACKEND_URL=http://localhost:8000` trong `frontend/.env.local`, mở [ứng dụng](http://localhost:3000). URL không kèm `/api/v1`: proxy tự thêm prefix. Frontend hiện không truy cập Supabase trực tiếp; chỉ cần `BACKEND_URL` cho proxy.

### Toàn bộ stack bằng Docker

Sau khi tạo `.env` và điền key:

```bash
docker compose up --build
docker compose down
```

Frontend cổng 3000, backend 8000, PostgreSQL 5432. Compose đặt database hostname `postgres`; frontend gọi `http://backend:8000`. Dùng `DOCKER_DATABASE_URL` nếu cần thay database container. Redis có trong Compose nhưng ứng dụng hiện chưa dùng. AI cần snapshot đã nạp riêng. Xem [guide dữ liệu Supabase](docs/SUPABASE_DATA_IMPORT.md) để chuẩn bị dữ liệu và vận hành mock có chủ đích.

## Cấu hình AI trong `.env`

| Biến | Ý nghĩa |
| --- | --- |
| `LLM_PROVIDER` | `openai`, `google`, `auto` |
| `MODEL_NAME` | OpenAI chat; mặc định `gpt-4o-mini` |
| `GOOGLE_MODEL_NAME` | Google chat; mặc định mã nguồn `gemini-3.8-flash`, cần chọn model có quyền truy cập |
| `OPENAI_API_KEY` | Key OpenAI chat và embedding truy vấn RAG |
| `GOOGLE_API_KEY` | Key Google chat |
| `LLM_TEMPERATURE` | Mặc định `0.0` |

Ví dụ OpenAI:

```dotenv
LLM_PROVIDER=openai
MODEL_NAME=gpt-4o-mini
OPENAI_API_KEY=<your-openai-key>
```

Ví dụ Google (thay placeholder bằng giá trị tài khoản):

```dotenv
LLM_PROVIDER=google
GOOGLE_MODEL_NAME=<your-google-chat-model>
GOOGLE_API_KEY=<your-google-key>
OPENAI_API_KEY=<your-openai-key-for-rag>
```

`auto` ưu tiên OpenAI nếu key đạt kiểm tra định dạng sơ bộ, sau đó Google; không xác minh key và không chuyển provider khi API lỗi. Khi dùng Gemini với OpenAI key cho RAG, đặt `LLM_PROVIDER=google`. Khởi động lại backend sau thay đổi vì settings và client được cache.

Corpus embedding cố định là `text-embedding-3-small`; đổi model chat không đổi embedding. Đổi embedding cần tạo lại corpus và cập nhật retrieval. RAG hiện không dùng ChromaDB/Pinecone.

## API và giao diện

Endpoint backend có prefix `/api/v1`; schema request/response xem tại Swagger.

| API | Mục đích |
| --- | --- |
| `POST /chat`, `GET /status` | Hội thoại và trạng thái agent |
| `GET /vehicles`, `POST /configurate` | Catalog và tính giá |
| `POST/GET /leads`, `PATCH /leads/{lead_id}` | Khách hàng tiềm năng |
| `POST/GET /quotes`, `POST /quote/approve` | Tạo, liệt kê, duyệt báo giá |
| `POST /quote/export-pdf` | Placeholder PDF |
| `GET/POST /promotions`, `PATCH/DELETE /promotions/{promo_id}` | Khuyến mãi |
| `GET /inventory`, `PATCH /inventory/{item_id}` | Tồn kho |

Trang chính: `/configurator`, `/configurator/customize`, `/configurator/quote`, `/login`, `/seller/dashboard`, `/seller/leads`, `/seller/quotes`, `/seller/promotions`, `/seller/inventory`, `/warehouse/dashboard`.

Hội thoại dùng checkpoint trong bộ nhớ tiến trình, mất khi restart và không chia sẻ giữa các instance. Giao diện nhân viên/API ghi dữ liệu cần hoàn thiện xác thực và phân quyền trước khi phục vụ dữ liệu thật.

## Dữ liệu và pipeline

```text
src/api/                 FastAPI routes
src/agents/              LangGraph, trạng thái, công cụ AI
src/config.py            Cấu hình từ .env
src/db.py, orm_models.py  PostgreSQL và ORM
src/pipeline/            Crawl, chuẩn hóa, chia chunk, lọc
frontend/                Next.js và proxy API
src/ai_data.py           Repository snapshot catalog và pgvector
scripts/db/              Migration, import dữ liệu riêng, kiểm tra và mock
tests/                   Kiểm thử backend, agent, pipeline
docs/CLOUD_DEPLOYMENT.md  Deploy public
docs/SUPABASE_DATA_IMPORT.md  Nạp/kiểm tra/rollback dữ liệu riêng
```

```bash
python -m src.pipeline --help
python -m src.pipeline run
python -m src.pipeline stats --stage gold
```

`run` xử lý Bronze → Silver → Gold; thêm `--crawl` để thu thập lại dữ liệu. Pipeline không tự tạo lại corpus embedding RAG. Xem [tài liệu pipeline](src/pipeline/README.md).

## Kiểm tra và triển khai

Với dependencies đã cài và `DATABASE_URL` PostgreSQL hợp lệ:

```bash
python -m pytest
python -m ruff check src tests
cd frontend
npm run lint
npm run build
```

Xem [cloud deploy](docs/CLOUD_DEPLOYMENT.md) cho cấu hình Supabase, Render, Vercel và kiểm tra sau triển khai.

## Tài liệu triển khai và vận hành

- [Deploy public](docs/CLOUD_DEPLOYMENT.md): kết nối Supabase đã sẵn sàng, deploy Render/Vercel và kiểm tra URL public; không đưa dữ liệu riêng vào image.
- [Nạp dữ liệu Supabase](docs/SUPABASE_DATA_IMPORT.md): backup, migration, nhập catalog/embedding riêng, kiểm tra và rollback phiên bản.

Database hiện có chạy `upgrade`, database trống chạy `bootstrap`. Không dùng seed để cập nhật dữ liệu thật. Import AI giữ nguyên bảng nghiệp vụ và nội dung pipeline; bảng riêng không mở cho browser roles.
