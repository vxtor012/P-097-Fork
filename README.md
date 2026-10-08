# Auto Car Configurator & Pricing AI Agent (VFO2O-04)

> **Tóm tắt 1 câu:** Tự động hóa quá trình tư vấn cấu hình dòng xe Xe X, áp dụng chính xác quy tắc giá & chương trình khuyến mãi theo thời gian thực và tự động tính chi phí lăn bánh theo tỉnh/thành cho Khách hàng & Tư vấn viên.

---

## Vấn đề (Problem)

**Thực trạng & Pain Point:**
- **Ai đang gặp vấn đề?** Khách hàng mua xe ô tô và Đội ngũ tư vấn viên bán hàng (Sales Representative / Consultant).
- **Vấn đề tốn bao nhiêu thời gian/tiền?** Khi chọn mua xe, khách hàng có nhu cầu tự cấu hình chi tiết (phiên bản, màu sắc, gói thuê/mua pin, phụ kiện) và nắm rõ chi phí lăn bánh chính xác. Tuy nhiên, bảng giá niêm yết, chính sách ưu đãi/khuyến mãi và lệ phí trước bạ thay đổi liên tục theo mẫu xe, thời điểm và đối tượng khách hàng. Tư vấn viên phải báo giá thủ công, mất nhiều thời gian tra cứu và dễ dẫn đến sai sót, báo giá không thống nhất.
- **Tại sao các giải pháp hiện tại chưa đủ?** Các công cụ configurator truyền thống hoặc bảng tính tĩnh thiếu linh hoạt trong việc kết hợp nhiều điều kiện khuyến mãi phức tạp, không cung cấp giải thích tự nhiên bằng AI, không cảnh báo xung đột cấu hình và thiếu quy trình kiểm duyệt báo giá chính thức (Human-in-the-Loop - HITL) trước khi gửi khách hàng.

---

## Giải pháp (Solution)

Hệ thống **AI Agent Cấu hình xe & Báo giá khuyến mãi tự động** giải quyết toàn diện vấn đề trên:

- **Cấu hình xe tương tác từng bước (Interactive Configurator):** Hướng dẫn người dùng chọn phiên bản, màu sơn, pin (mua đứt vs thuê pin) và phụ kiện; tự động kiểm tra & cảnh báo khi có lựa chọn cấu hình không hợp lý/xung đột.
- **Tính giá & Khuyến mãi chuẩn xác (Deterministic Pricing & RAG Engine):** Tích hợp RAG trên Vector DB để cập nhật chính xác bảng giá & ưu đãi mới nhất. Sử dụng công cụ tính toán deterministic (không để LLM tự tính tiền) để đảm bảo độ chính xác 100% khi áp khuyến mãi và phí lăn bánh theo từng tỉnh/thành.
- **Quy trình Báo giá & Duyệt HITL (Human-in-the-Loop):** Hỗ trợ 2 vai trò (Khách hàng & Tư vấn viên), cho phép xuất file báo giá PDF chuyên nghiệp. Mọi báo giá chính thức đều trải qua luồng tư vấn viên kiểm duyệt (HITL) để ghi log phiên bản giá và bảo mật thông tin khách hàng.
- **Tính năng nâng cao:**
  - Cảnh báo & khuyến nghị gói cấu hình tối ưu theo ngân sách khách hàng.
  - Phân tích & so sánh bài toán tài chính: Mua pin vs Thuê pin theo thời gian sử dụng.
  - Quản lý lịch sử báo giá khách hàng & Dashboard đánh giá hiệu quả chương trình khuyến mãi.

---

## Target User

- **Primary User:** Khách hàng cá nhân / doanh nghiệp có nhu cầu tìm hiểu, tùy chỉnh cấu hình xe và nhận bảng báo giá dự toán chi tiết.
- **Secondary User:** Tư vấn viên bán hàng (Sales / Consultant) cần công cụ tự động hóa tính giá, kiểm tra báo giá chính xác (HITL) và xuất file PDF gửi khách hàng.

---

## Tech Stack

| Layer | Technology | Chi tiết |
|-------|-----------|----------|
| **AI Agent Orchestration** | LangGraph + LangChain 0.3 | Điều phối luồng cấu hình, kiểm tra quy tắc giá & phản hồi hội thoại |
| **LLM Service** | OpenAI GPT-4o / Gemini | Xử lý hội thoại tự nhiên, tư vấn & giải thích chi tiết |
| **RAG & Vector DB** | ChromaDB / Vector Store | Tra cứu bảng giá, chính sách khuyến mãi & lệ phí trước bạ theo tỉnh |
| **Calculation Engine** | Python Deterministic Tool Engine | Tính toán giá cuối, ưu đãi & phí lăn bánh tuyệt đối chính xác |
| **Backend API** | FastAPI + Python 3.11+ | RESTful API server, async processing, Pydantic validation |
| **Frontend UI** | Next.js 15 + TypeScript + Tailwind CSS | Giao diện Car Configurator 3 panel (Khách / Tư vấn viên / Thủ kho) |
| **Database** | PostgreSQL / SQLite | Lưu trữ dữ liệu cấu hình, lịch sử báo giá & phiên bản bảng giá |
| **Export Service** | PDF Generator (ReportLab / WeasyPrint) | Xuất báo giá PDF chính thức |
| **DevOps & CI/CD** | Docker + GitHub Actions (Render / Vercel) | Multi-stage build, tự động lint, test & deploy |

---

## Quick Start

### Yêu cầu hệ thống

| Tool | Version |
|------|---------|
| Python | ≥ 3.11 |
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Docker | ≥ 24 (tuỳ chọn) |

---

### Cách 1: Chạy thủ công (khuyến nghị khi phát triển)

#### Bước 1 — Clone repo

```bash
git clone https://github.com/AI20K-Build-Phase-Cohort-4/P-097.git
cd P-097
```

#### Bước 2 — Setup Backend

```bash
# Tạo virtual environment
python3.11 -m venv .venv

# Kích hoạt (Linux/macOS)
source .venv/bin/activate
# Kích hoạt (Windows)
.venv\Scripts\activate

# Cấu hình biến môi trường
cp .env.example .env
# Điền OPENAI_API_KEY hoặc GOOGLE_API_KEY (Gemini), cùng AI_LOG_API_KEY
# LLM_PROVIDER=auto tự chọn OpenAI nếu có key thật, nếu không sẽ dùng Gemini
# Đảm bảo CORS_ORIGINS có http://localhost:3000

# Cài đặt dependencies
pip install -r requirements.txt

# Chạy backend (từ thư mục gốc repo)
uvicorn src.main:app --reload --port 8000
```

Kiểm tra backend hoạt động:

```bash
curl http://localhost:8000/health
# Kết quả: {"status":"ok","env":"..."}
```

Swagger UI: http://localhost:8000/docs

> **Lưu ý:** mỗi lần mở terminal mới phải kích hoạt lại venv (`source .venv/bin/activate`) trước khi chạy `uvicorn`, nếu không sẽ gặp lỗi `No module named 'fastapi'`.

#### Bước 3 — Setup Frontend (mở terminal mới)

```bash
# Vào thư mục frontend
cd frontend

# Cài dependencies
npm install

# Tạo file môi trường
cp .env.local.example .env.local
# Không cần sửa nếu backend đang chạy ở localhost:8000

# Chạy frontend
npm run dev
```

Mở trình duyệt: http://localhost:3000

---

### Cách 2: Chạy bằng Docker (Full Stack)

```bash
# Build và chạy toàn bộ stack
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |

Dừng:

```bash
docker compose down
```

---

## Frontend UI (Next.js)

Giao diện người dùng do **Phùng Thành An** phát triển, nằm trong thư mục `frontend/`.

### Các trang chính

| URL | Dành cho | Mô tả |
|-----|----------|-------|
| `/configurator` | Khách hàng | Chọn xe + xem chi phí lăn bánh + chat với AI Agent (không cần đăng nhập) |
| `/login` | Nhân viên | Đăng nhập phân quyền theo role |
| `/seller/dashboard` | Tư vấn viên | Tổng quan, biểu đồ leads & báo giá |
| `/seller/promotions` | Tư vấn viên | CRUD chương trình khuyến mãi |
| `/seller/inventory` | Tư vấn viên | Xem / cập nhật kho xe |
| `/seller/leads` | Tư vấn viên | Danh sách khách hàng từ chat AI |
| `/seller/quotes` | Tư vấn viên | Duyệt báo giá (HITL) |
| `/warehouse/dashboard` | Thủ kho | Tổng quan tồn kho theo chi nhánh, cảnh báo hết hàng |

### Giao diện Configurator (3 panel)

```text
┌────────────────┬──────────────────────────┬──────────────────┐
│ Chọn xe        │ Chi phí lăn bánh         │ Chat với Agent   │
│                │                          │                  │
│ • Dòng xe      │ • Giá xe                 │ • Context chip   │
│ • Phiên bản    │ • Pin / phụ kiện         │ • Câu hỏi gợi ý  │
│ • Màu sắc      │ • Trước bạ, đường bộ...  │ • Bubble chat    │
│ • Tỉnh/thành   │ • Khuyến mãi             │                  │
│ • Gói pin      │ ───────────────          │ [Nhập câu hỏi]   │
│ • Phụ kiện     │ TỔNG: xxx VNĐ            │                  │
│ [Hỏi AI] ──────┼──────────────────────────┼─→ gửi context    │
│ [Yêu cầu BG]   │ [Xuất PDF] [Báo giá]     │                  │
└────────────────┴──────────────────────────┴──────────────────┘
```

### Tài khoản demo Frontend

Khách hàng xem giá xe & chat AI **không cần đăng nhập**. Tài khoản dưới đây là mock (hardcode trong `frontend/lib/auth-store.ts`), cần thay bằng API thật trước khi deploy production.

| Role | Email | Mật khẩu | Dashboard |
|------|-------|----------|-----------|
| Nhân viên kinh doanh | `seller@abc.vn` | `123456` | `/seller/dashboard` |
| Thủ kho | `warehouse@abc.vn` | `123456` | `/warehouse/dashboard` |
| Admin | `admin@vinfast.vn` | `admin123` | `/admin/dashboard` |

### Biến môi trường Frontend

File `frontend/.env.local` (copy từ `.env.local.example`):

```env
BACKEND_URL=http://localhost:8000
```

Trong Docker, `BACKEND_URL` được đặt thành `http://backend:8000` qua `docker-compose.yml`.

### Mapping Frontend ↔ Backend API

Frontend gọi backend qua các route proxy của Next.js (server-to-server, không bị CORS chặn):

| Tính năng Frontend | Next.js proxy | Endpoint Backend | Trạng thái |
|--------------------|---------------|------------------|------------|
| Chat AI | `/api/chat` | `POST /api/v1/chat` | Đã nối |
| Tính giá lăn bánh | `/api/configurate` | `POST /api/v1/configurate` | Proxy sẵn, UI vẫn tính client-side |
| Duyệt báo giá (HITL) | `/api/quote/approve` | `POST /api/v1/quote/approve` | Proxy sẵn, UI đang dùng mock |
| Xuất PDF | `/api/quote/export-pdf` | `POST /api/v1/quote/export-pdf` | Proxy sẵn, UI đang dùng mock |

Luồng chat:

```text
User nhập → frontend /api/chat
          → POST http://localhost:8000/api/v1/chat   body: { "message": "..." }
          ← JSON { "response": "...", "session_id": "..." }
          → proxy chuyển JSON về chat panel
```

Agent dùng tool có cấu trúc cho giá/phí/khuyến mãi và vector retrieval cho kiến thức tư vấn. RAG nạp vectors có sẵn từ `dataset/gold/vinfast_embeddings.jsonl` (model `text-embedding-3-small`, 1536 chiều), không tạo lại embedding corpus; mỗi truy vấn RAG gọi OpenAI Embeddings để vector hóa câu hỏi rồi xếp hạng cosine. Vì vậy cần `OPENAI_API_KEY` khi dùng RAG, kể cả khi chat model được chọn là Gemini.

### Phần đang dùng mock (chưa nối API thật)

| Tính năng | Trạng thái | Cần làm tiếp |
|-----------|-----------|--------------|
| Chat AI | Nối thật | — |
| Tính giá lăn bánh | Client-side (`use-configurator.ts`) | Chuyển sang gọi `/api/v1/configurate` |
| Khuyến mãi CRUD | Mock data | Cần API CRUD promotions |
| Kho xe / Thủ kho | Mock data | Cần API inventory |
| Leads | Mock data | Cần API leads |
| Duyệt báo giá (HITL) | Mock data | Nối `/api/v1/quote/approve` |
| Xuất PDF | Chưa nối | Nối `/api/v1/quote/export-pdf` |
| Đăng nhập | Mock users hardcode | Cần API auth thật (JWT) |

Chi tiết xem thêm: [`frontend/README.md`](frontend/README.md)

---

## Project Structure

```text
.
├── src/                          # Backend Python (FastAPI + LangGraph)
│   ├── agents/                   # LangGraph agent definitions
│   │   ├── graph.py              #   Main state graph (nodes + edges)
│   │   ├── state.py              #   AgentState schema (TypedDict)
│   │   ├── nodes/                #   Node functions (parse, analyze, calculate, format)
│   │   └── tools/                #   Tools (pricing calculation, RAG search, PDF export)
│   ├── api/                      # FastAPI routes & handlers
│   │   └── routes.py             #   Endpoint definitions
│   ├── models/                   # Pydantic data schemas
│   │   └── schemas.py            #   Request/Response models
│   ├── pipeline/                 # Vietnamese Pre-RAG Data Pipeline (Bronze → Silver → Gold)
│   │   ├── crawlers/             #   Web & API crawlers (Live Pricing API, FAQ, Promos, PDFs)
│   │   ├── extractors/           #   Extractors (HTML, FAQ, Relational API, PDF)
│   │   ├── nlp/                  #   Vietnamese text normalizer & sentence splitter
│   │   ├── chunking/             #   Hierarchical chunker with breadcrumb context
│   │   ├── filters/              #   Gold consultation filter & chunk deduplicators
│   │   ├── storage/              #   Data persistence writers & report generators
│   │   └── README.md             #   Chi tiết kiến trúc Data Pipeline
│   ├── services/                 # Business logic (LLM client, pricing engine, RAG)
│   ├── config.py                 # Environment settings
│   └── main.py                   # FastAPI application entry point
│
├── frontend/                     # Frontend Next.js 15 (Phùng Thành An)
│   ├── app/
│   │   ├── configurator/         #   Trang chính: chọn xe + xem giá + chat AI
│   │   ├── seller/               #   Dashboard tư vấn viên
│   │   │   ├── dashboard/        #     Tổng quan & biểu đồ
│   │   │   ├── promotions/       #     CRUD khuyến mãi
│   │   │   ├── inventory/        #     Kho xe
│   │   │   ├── leads/            #     Khách hàng từ chat
│   │   │   └── quotes/           #     Duyệt báo giá (HITL)
│   │   ├── warehouse/            #   Dashboard thủ kho
│   │   ├── login/                #   Đăng nhập phân quyền
│   │   └── api/                  #   Next.js proxy → Backend API
│   │       ├── chat/             #     → POST /api/v1/chat
│   │       ├── configurate/      #     → POST /api/v1/configurate
│   │       └── quote/            #     → POST /api/v1/quote/*
│   ├── components/
│   │   ├── configurator/         #   SelectorPanel, PricingPanel, ChatPanel
│   │   ├── seller/               #   Components dashboard seller
│   │   ├── shared/               #   Header, BuyerIdentityModal
│   │   └── ui/                   #   shadcn/ui base components
│   ├── hooks/
│   │   ├── use-chat.ts           #   Chat với backend (SSE)
│   │   └── use-configurator.ts   #   Tính giá deterministic phía client
│   ├── lib/
│   │   ├── auth-store.ts         #   Zustand auth + cookie cho middleware
│   │   ├── vehicle-data.ts       #   Data xe, tỉnh, phụ kiện (mock)
│   │   ├── seller-mock-data.ts   #   Mock data dashboard
│   │   └── format.ts             #   formatVND helper
│   ├── middleware.ts             #   Bảo vệ route /seller /warehouse /admin theo role
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── .env.local.example
│   └── README.md                 #   Hướng dẫn chi tiết frontend
│
├── dataset/                      # Dữ liệu phân tầng Medallion (Bronze, Silver, Gold, PDF)
├── tests/                        # Pytest suite (unit & integration)
├── docs/                         # Documentation & architecture diagrams
├── eval/                         # Evaluation evidence & test results
├── presentation/                 # Demo Day pitch deck & video
├── Dockerfile                    # Multi-stage Docker build (backend)
├── docker-compose.yml            # Full stack deployment (backend + frontend)
└── .github/workflows/            # CI/CD (ruff, pytest)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Kiểm tra trạng thái hoạt động của hệ thống (Health check) |
| `GET` | `/api/v1/status` | Kiểm tra trạng thái và phiên bản của LangGraph Agent |
| `POST` | `/api/v1/chat` | Tương tác hội thoại tư vấn cấu hình xe với AI Agent |
| `POST` | `/api/v1/configurate` | Gửi lựa chọn cấu hình xe và tính toán giá lăn bánh |
| `POST` | `/api/v1/quote/approve` | Tư vấn viên duyệt báo giá chính thức (HITL) |
| `POST` | `/api/v1/quote/export-pdf` | Xuất bảng báo giá định dạng PDF |

### Ví dụ gọi API

```bash
# Chat với AI Agent
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "VF6 Plus giá bao nhiêu tại Hà Nội?"}'
# → {"response": "...", "analysis": "..."}

# Tính giá lăn bánh
curl -X POST http://localhost:8000/api/v1/configurate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "VF6",
    "version": "Plus",
    "color": "Trắng Tinh Khôi",
    "province": "Hà Nội",
    "battery": "rent",
    "accessories": []
  }'
```

> Schema chính xác của `/configurate` và `/quote/*` xem tại `src/models/schemas.py`.

---

## Luồng hoạt động

```text
Khách hàng (không cần login)
    │
    ▼
/configurator  ←── Chọn xe + xem giá lăn bánh + chat AI
    │
    ├── Chat AI ──────────────→ POST /api/v1/chat
    │                               │
    │                          LangGraph Agent
    │                          (RAG + Pricing Tool)
    │                               │
    │◄──────────────────────── { response, analysis }
    │
    └── Yêu cầu báo giá ──→ Điền tên + SĐT (modal)
                                    │
                               POST /api/v1/configurate
                                    │
                            Tạo Quote (pending)
                                    │
                        Thông báo Tư vấn viên
                                    │
Tư vấn viên (cần login)             │
    │                               │
    ▼                               ▼
/seller/quotes ◄──────── Xem Quote chờ duyệt
    │
    ├── Duyệt ──→ POST /api/v1/quote/approve
    └── PDF   ──→ POST /api/v1/quote/export-pdf
                        │
                   Gửi PDF cho khách
```

---

## Quy tắc đóng góp (Git workflow)

- Không push trực tiếp vào `main`. Tạo nhánh riêng, ví dụ `feature/frontend-ui`, rồi mở Pull Request để nhóm review.
- Không commit `.env`, `.env.local`, `node_modules/`, `.next/`, `.venv/` (đã có trong `.gitignore`).
- Backend của nhóm nằm ở `src/`; không tạo thêm thư mục `backend/` riêng để tránh trùng lặp.

---

## Deliverables Checklist

- [x] **Source Code**: Mã nguồn đầy đủ trên GitHub (`src/`)
- [x] **Frontend UI**: Giao diện Next.js 15 (`frontend/`)
- [x] **README.md**: Tài liệu hướng dẫn & giới thiệu dự án hoàn chỉnh
- [x] **Architecture Diagram**: Sơ đồ kiến trúc chi tiết (`docs/architecture_diagram.md` & `ARCHITECTURE.md`)
- [x] **AI Logs**: Tự động thu thập & đồng bộ AI prompt logging
- [ ] **Live URL**: Deploy phiên bản thử nghiệm trên Vercel / Render
- [ ] **Video Demo**: Video trình diễn tính năng sản phẩm (`presentation/`)
- [ ] **Pitch Deck**: Slide thuyết trình cho Demo Day (`presentation/`)
- [x] **Development Journal**: Nhật ký phát triển hàng tuần (`JOURNAL.md`)
- [x] **Worklog**: Nhật ký công việc chi tiết (`WORKLOG.md`)
- [ ] **Evaluation Evidence**: Bằng chứng đánh giá độ chính xác 100% trên bộ test giá (`eval/results/`)

---

## Team Members (Phòng C401)

| Thành viên | Vai trò | MSSV | Chuyên môn / Đóng góp |
|------------|---------|------|-----------------------|
| **Nguyễn Đức Anh** 👑 | Team Lead / Fullstack / AI Engineer | `2A202602888` | Backend, Frontend, Machine Learning, UI/UX Design, Project Management, User Research |
| **Lại Bá Quân** | Backend / Data & DevOps | `2A202602495` | Backend, Data Engineering, DevOps/Cloud, Prompt Engineering, Business Analysis |
| **Đồng Mạnh Hùng** | ML & NLP Engineer / Backend | `2A202602412` | Machine Learning, NLP, Computer Vision, Business Analysis, Communication |
| **Phùng Thành An** | UI/UX Designer / AI & DevOps Engineer | `2A202603006` | Frontend Next.js, UI/UX Design, DevOps/Cloud, Product Management |

---

## License

Dự án được phân phối dưới giấy phép [MIT License](LICENSE).