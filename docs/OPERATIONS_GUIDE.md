# Sổ tay Vận hành Hệ thống (Operations Guide) — VinFast AI Agent

Tài liệu này hướng dẫn chi tiết quy trình triển khai, khởi chạy, kiểm tra và bảo trì hệ thống **VinFast AI Agent & Car Configurator** bằng Docker và Docker Compose, được trích xuất và chuẩn hóa trực tiếp từ cấu trúc codebase hiện hành.

---

## 1. Tổng quan Kiến trúc Dịch vụ Docker

Hệ thống được thiết kế theo kiến trúc microservices/multi-container chạy trên mạng bridge nội bộ `vinfast_net`:

```mermaid
graph TD
    Client[Browser / Client] -->|Port 3000| Frontend[vinfast_frontend: Next.js 16 Standalone]
    Client -->|Port 8000| Backend[vinfast_backend: FastAPI]
    Frontend -->|Internal: http://backend:8000| Backend
    Backend -->|Internal: postgres:5432| Postgres[(vinfast_postgres: PostgreSQL 16)]
    Backend -->|Internal: redis:6379| Redis[(vinfast_redis: Redis 7)]
    Postgres -->|Volume mount| PGData[(vinfast_pg_data Volume)]
```

### Chi tiết các dịch vụ trong `docker-compose.yml`:

| Service | Container Name | Image / Base | Cổng Host | Chức năng & Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **`postgres`** | `vinfast_postgres` | `postgres:16-alpine` | `5432:5432` | CSDL chính. Tự động chạy `schema.sql` và `seed.sql` khi tạo volume lần đầu. Có healthcheck `pg_isready`. |
| **`redis`** | `vinfast_redis` | `redis:7-alpine` | `6379:6379` | Bộ nhớ đệm cache và message broker. |
| **`backend`** | `vinfast_backend` | Multi-stage `python:3.11-slim` (`Dockerfile`) | `8000:8000` | FastAPI server, LangGraph Agent, SQLAlchemy ORM (asyncpg). Chạy dưới user `appuser` (non-root). |
| **`frontend`** | `vinfast_frontend` | 3-stage `node:22-alpine` (`frontend/Dockerfile`) | `3000:3000` | Next.js 16 App Router (standalone mode), Three.js 3D Configurator, Tailwind v4. Chạy dưới user `nextjs` (non-root). |

---

## 2. Yêu cầu Tiền đề (Prerequisites)

- **Docker Desktop** (trên Windows/macOS) hoặc **Docker Engine** + **Docker Compose v2+** (trên Linux).
- Tối thiểu 4GB RAM khả dụng cho Docker engine.
- API Key hợp lệ cho LLM:
  - `OPENAI_API_KEY` (nếu dùng OpenAI - mặc định model `gpt-4o-mini`)
  - HOẶC `GOOGLE_API_KEY` (nếu dùng Gemini - model `gemini-3.8-flash`)

---

## 3. Cấu hình Môi trường (.env)

Trước khi khởi động, cần thiết lập file cấu hình `.env` ở thư mục gốc:

### 3.1. Tạo file `.env`
Sao chép từ file mẫu:
```bash
cp .env.example .env
```
*(Trên Windows PowerShell: `Copy-Item .env.example .env`)*

### 3.2. Thiết lập các biến môi trường thiết yếu
Mở `.env` và cập nhật các giá trị tối thiểu sau:

```ini
# ---- LLM Configuration ----
LLM_PROVIDER=auto
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
# Hoặc cấu hình Google Gemini:
# LLM_PROVIDER=google
# GOOGLE_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxx

# ---- Ứng dụng & Cổng ----
APP_ENV=development
APP_PORT=8000
FRONTEND_PORT=3000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://frontend:3000

# ---- Backend Connection String trong Docker ----
# Lưu ý: docker-compose.yml đã có fallback nội bộ:
# DOCKER_DATABASE_URL=postgresql+asyncpg://vinfast:vinfast123@postgres:5432/vinfast_ai
# DOCKER_REDIS_URL=redis://redis:6379/0
```

---

## 4. Hướng dẫn Khởi chạy với Docker Compose

### 4.1. Khởi động toàn bộ cụm dịch vụ
Chạy lệnh build và khởi động tất cả container ở chế độ nền (detached):

```bash
docker compose up -d --build
```

> **Cơ chế khởi động tuần tự (Healthcheck & Depends On):**
> 1. `vinfast_postgres` khởi động và nạp dữ liệu từ `scripts/db/schema.sql`, `scripts/db/seed.sql`.
> 2. `vinfast_redis` khởi động.
> 3. `vinfast_backend` chỉ khởi động khi `postgres` đã vượt qua bước healthcheck (`service_healthy`) và `redis` đã start.
> 4. `vinfast_frontend` chỉ khởi động khi `backend` đã vượt qua bước healthcheck tại endpoint `/health`.

### 4.2. Kiểm tra trạng thái các container
```bash
docker compose ps
```

Kết quả mong đợi:
```text
NAME               IMAGE            STATUS                    PORTS
vinfast_backend    p-097-backend    Up (healthy)              0.0.0.0:8000->8000/tcp
vinfast_frontend   p-097-frontend   Up                        0.0.0.0:3000->3000/tcp
vinfast_postgres   postgres:16-alp  Up (healthy)              0.0.0.0:5432->5432/tcp
vinfast_redis      redis:7-alpine   Up                        0.0.0.0:6379->6379/tcp
```

### 4.3. Xác minh hệ thống hoạt động

1. **Frontend Web UI**: Truy cập [http://localhost:3000](http://localhost:3000)
2. **Backend Health Check**:
   ```bash
   curl http://localhost:8000/health
   # Phản hồi: {"status":"ok","env":"development"}
   ```
3. **Swagger API Interactive Documentation**: Truy cập [http://localhost:8000/docs](http://localhost:8000/docs)
4. **Kiểm tra Catalog Xe**:
   ```bash
   curl http://localhost:8000/api/v1/vehicles
   ```

---

## 5. Thao tác Quản trị & Vận hành Thường nhật

### 5.1. Xem nhật ký (Logs)
- **Xem logs toàn bộ hệ thống (stream realtime)**:
  ```bash
  docker compose logs -f
  ```
- **Xem logs riêng từng dịch vụ**:
  ```bash
  docker compose logs -f backend
  docker compose logs -f frontend
  docker compose logs -f postgres
  ```

### 5.2. Tương tác trực tiếp với Database (PostgreSQL)
- **Truy cập CLI `psql` trong container**:
  ```bash
  docker compose exec postgres psql -U vinfast -d vinfast_ai
  ```
- **Kiểm tra danh sách bảng**:
  ```bash
  docker compose exec postgres psql -U vinfast -d vinfast_ai -c "\dt"
  ```
- **Kiểm tra số lượng dữ liệu đã nạp (Seed status)**:
  ```bash
  docker compose exec postgres psql -U vinfast -d vinfast_ai -c "
  SELECT tablename, n_live_tup AS rows FROM pg_stat_user_tables ORDER BY tablename;
  "
  ```
- **Chạy lại seed data thủ công khi cần**:
  ```bash
  docker compose exec -T postgres psql -U vinfast -d vinfast_ai < scripts/db/seed.sql
  ```

### 5.3. Tương tác với Redis
- **Kiểm tra kết nối Redis ping**:
  ```bash
  docker compose exec redis redis-cli ping
  # Phản hồi: PONG
  ```

### 5.4. Chạy kiểm thử tự động (Test Suite) trong Docker
Chạy toàn bộ pytest suite ngay trong môi trường backend container:
```bash
docker compose exec backend pytest tests/ -v
```

### 5.5. Rebuild riêng lẻ khi có thay đổi code
- Khi sửa code backend hoặc requirements:
  ```bash
  docker compose up -d --build backend
  ```
- Khi sửa code frontend (lưu ý: Next.js standalone build phụ thuộc biến build arg):
  ```bash
  docker compose up -d --build frontend
  ```

---

## 6. Dừng & Dọn dẹp Hệ thống

- **Dừng các container (giữ nguyên dữ liệu database)**:
  ```bash
  docker compose down
  ```
- **Dừng và xoá sạch volume dữ liệu (Reset DB hoàn toàn về trạng thái ban đầu)**:
  ```bash
  docker compose down -v
  ```
- **Dọn dẹp triệt để images thừa hoặc layer cũ**:
  ```bash
  docker system prune -f
  ```

---

## 7. Xử lý Sự cố Thường gặp (Troubleshooting)

### 7.1. Backend báo lỗi: `RuntimeError: Configure OPENAI_API_KEY or GOOGLE_API_KEY`
- **Nguyên nhân**: File `.env` chưa có API Key hoặc key mang giá trị placeholder (`sk-your-key-here`).
- **Cách xử lý**:
  1. Cập nhật `OPENAI_API_KEY` hoặc `GOOGLE_API_KEY` trong file `.env`.
  2. Khởi động lại backend:
     ```bash
     docker compose restart backend
     ```

### 7.2. Xung đột cổng (Port conflict: 5432, 6379, 8000, 3000)
- **Triệu chứng**: `Error response from daemon: Ports are not available: exposing port TCP 0.0.0.0:5432...`
- **Nguyên nhân**: Máy host đang chạy PostgreSQL, Redis hoặc ứng dụng khác chiếm cổng.
- **Cách xử lý**:
  - Tắt ứng dụng đang chiếm cổng trên host, hoặc:
  - Thay đổi cổng ánh xạ bên trái trong file `docker-compose.yml` (ví dụ `"5433:5432"`, `"8001:8000"`, hoặc sửa `FRONTEND_PORT=3001` trong `.env`).

### 7.3. Frontend không gọi được Backend từ Browser
- **Triệu chứng**: Giao diện báo lỗi mạng hoặc CORS error khi cấu hình xe/chat AI.
- **Nguyên nhân**:
  - `NEXT_PUBLIC_API_URL` được nướng vào bundle lúc build client. Nếu đổi cổng backend trên host mà không rebuild frontend, client browser vẫn gửi request về cổng cũ.
  - `CORS_ORIGINS` trong `.env` chưa chứa domain/port của frontend.
- **Cách xử lý**:
  1. Đảm bảo `CORS_ORIGINS` bao gồm nguồn gọi của frontend.
  2. Rebuild frontend với tham số chính xác:
     ```bash
     docker compose build --no-cache frontend
     docker compose up -d frontend
     ```

### 7.4. Database không có bảng hoặc dữ liệu mẫu
- **Nguyên nhân**: Volume `vinfast_pg_data` đã được khởi tạo từ trước khi thêm file seed.
- **Cách xử lý**:
  ```bash
  docker compose down -v
  docker compose up -d postgres
  # Đợi 5 giây cho container tự nạp schema và seed, sau đó chạy:
  docker compose up -d
  ```

---

## 8. Danh mục Cổng & Điểm kết nối (Reference Ports & Endpoints)

| Dịch vụ | Địa chỉ Host | Tài khoản / Thông số |
| :--- | :--- | :--- |
| **Frontend Web** | `http://localhost:3000` | Giao diện tư vấn xe & 3D Configurator |
| **Backend API Docs** | `http://localhost:8000/docs` | Swagger UI tương tác trực tiếp API |
| **Backend Health** | `http://localhost:8000/health` | HTTP GET trả về JSON status |
| **PostgreSQL** | `localhost:5432` | User: `vinfast` \| Pass: `vinfast123` \| DB: `vinfast_ai` |
| **Redis** | `localhost:6379` | Database `0`, không mật khẩu mặc định |
