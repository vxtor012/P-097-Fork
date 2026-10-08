# AutoQuote AI — Cấu hình xe và tư vấn báo giá VinFast

Ứng dụng hỗ trợ chọn dòng xe, phiên bản, màu sắc, pin, phụ kiện và tỉnh/thành đăng ký; xem dự toán chi phí lăn bánh và trao đổi với AI bằng tiếng Việt. Backend cung cấp API dữ liệu xe, báo giá, khuyến mãi, khách hàng tiềm năng và tồn kho.

## Chức năng và trạng thái

| Chức năng | Triển khai hiện tại |
| --- | --- |
| Configurator | Chọn cấu hình, xem xe 3D, dự toán; tải catalog qua `/api/vehicles`, có dữ liệu dự phòng frontend |
| Chat AI | Proxy Next.js gọi FastAPI; LangGraph điều phối hội thoại và công cụ |
| Giá, phí, ưu đãi trong chat | Công cụ Python tính từ catalog CSV trong `dataset/gold/rdb_schema` |
| RAG | Tìm kiếm cosine trên vector JSONL có sẵn; OpenAI embedding câu hỏi |
| API nghiệp vụ | PostgreSQL lưu giá xe, pin, phụ kiện, phí, khuyến mãi, leads, báo giá và tồn kho |
| Duyệt báo giá | Backend cập nhật trạng thái duyệt/từ chối; frontend vẫn dùng mock |
| Đăng nhập và dashboard | Đăng nhập demo và dữ liệu mock; chưa có xác thực backend hoàn chỉnh |
| Xuất PDF | Endpoint placeholder trả URL; chưa tạo PDF thực tế |

Configurator tính dự toán ở client. Chat đọc catalog Gold, API nghiệp vụ đọc PostgreSQL: các nguồn độc lập này cần được đồng bộ khi cập nhật bảng giá. Dữ liệu repository là snapshot, không bảo đảm giá hoặc ưu đãi theo thời gian thực.

## Kiến trúc

```text
Browser → Next.js → proxy API → FastAPI
                                ├─ LangGraph → OpenAI / Google chat
                                │              ├─ Gold CSV catalog
                                │              └─ Gold vectors + OpenAI Embeddings
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

Điền key, chọn provider/model trong `.env`. URL database mẫu kết nối PostgreSQL local cổng 5432. Compose nạp `scripts/db/schema.sql` và `seed.sql` khi tạo volume database lần đầu; khởi động lại không nạp lại seed. Backend chỉ tạo bảng thiếu, không tự seed. SQLite chưa phù hợp với ORM PostgreSQL và dependencies hiện tại.

```bash
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

Frontend cổng 3000, backend 8000, PostgreSQL 5432. Compose đặt database hostname `postgres`; frontend gọi `http://backend:8000`. Dùng `DOCKER_DATABASE_URL` nếu cần thay database container. Redis có trong Compose nhưng ứng dụng hiện chưa dùng.

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
dataset/gold/            Corpus RAG và catalog cấu trúc
scripts/db/              Schema và seed SQL
tests/                   Kiểm thử backend, agent, pipeline
docs/CLOUD_DEPLOYMENT.md  Cloud deploy
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

- [Cloud deployment](docs/CLOUD_DEPLOYMENT.md): deploy từ đầu và thứ tự cập nhật release.
- [Supabase database guide](docs/SUPABASE_DATABASE_GUIDE.md): tạo database, backup, nâng cấp schema cũ, cập nhật dữ liệu và phục hồi.
- [Operations guide](docs/OPERATIONS_GUIDE.md): tiếp quản, kiểm tra dịch vụ, logs, cấu hình, release và xử lý sự cố.

Schema/seed đã được sửa và migration nâng cấp được lưu trong `supabase/migrations/`. Database cũ chạy `python scripts/db/migrate_supabase.py upgrade`, sau đó `check`; database trống dùng `bootstrap` (thêm `--seed` chỉ cho demo). Không chạy lại seed để cập nhật giá. Bảng chỉ truy cập qua backend; RLS bật và browser roles không có quyền truy cập trực tiếp.
