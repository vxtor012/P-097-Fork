# 🚀 Hướng Dẫn Triển Khai Cloud: Supabase + Render + Vercel

Tài liệu này hướng dẫn chi tiết quy trình đưa toàn bộ hệ sinh thái **VinFast AI Agent (P-097)** lên hạ tầng Cloud production:
- **Database**: Supabase PostgreSQL
- **Backend API & AI Agent**: Render (FastAPI + LangGraph Docker Web Service)
- **Frontend App**: Vercel (Next.js 15)

---

## 🏗 Kiến Trúc Triển Khai

```mermaid
flowchart LR
    User([Người dùng]) --> Vercel["Vercel (Frontend Next.js)"]
    Vercel -- REST API --> Render["Render (Backend FastAPI + LangGraph)"]
    Render -- Transaction Pooler :6543 --> Supabase[("Supabase (PostgreSQL 17)")]
    Render -- AI Inference --> Gemini["Google Gemini API / OpenAI"]
```

---

## 1. 🗄 Bước 1: Triển Khai Database lên Supabase

Dự án đã có script tự động [scripts/db/migrate_supabase.py](file:///c:/Users/Vxtor/Documents/workspace/P-097/scripts/db/migrate_supabase.py) nạp toàn bộ cấu trúc bảng và dữ liệu mẫu lên Supabase PostgreSQL.

### Hiện trạng
- **Project ID**: `ddkeoxomfypnoqdcxwxa` (Region: `aws-0-ap-southeast-1`)
- **Trạng thái**: Đã chạy migration thành công! Các bảng `dealers`, `users`, `vehicle_prices`, `battery_prices`, `accessories`, `rolling_costs`, `promotions`, `quotes`, `leads` đã có dữ liệu đầy đủ.
- **Connection String (Transaction Pooler - khuyến nghị cho Cloud/Serverless)**:
  ```text
  postgresql+asyncpg://postgres.ddkeoxomfypnoqdcxwxa:Tckzeros.11@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
  ```

> [!NOTE]
> Mã nguồn backend tại [src/db.py](file:///c:/Users/Vxtor/Documents/workspace/P-097/src/db.py) đã được cấu hình tự động vô hiệu hóa statement cache (`statement_cache_size=0`) khi nhận diện URL Supabase Transaction Pooler, tránh lỗi `prepared statement already exists`.

---

## 2. ⚡ Bước 2: Triển Khai Backend lên Render

Dự án đã tạo sẵn file Blueprint Infrastructure-as-Code [render.yaml](file:///c:/Users/Vxtor/Documents/workspace/P-097/render.yaml).

### Cách 1: Triển khai bằng Render Blueprint (Khuyên dùng - 1 click)
1. Đẩy code lên GitHub:
   ```bash
   git add .
   git commit -m "feat(deploy): add Render Blueprint and Vercel configs"
   git push origin main
   ```
2. Truy cập [Render Dashboard Blueprints](https://dashboard.render.com/blueprints).
3. Bấm **New Blueprint Instance** -> Chọn repository `AI20K-Build-Phase-Cohort-4/P-097`.
4. Render sẽ tự động đọc [render.yaml](file:///c:/Users/Vxtor/Documents/workspace/P-097/render.yaml).
5. Điền các biến môi trường được đánh dấu bí mật (`sync: false`):
   - `DATABASE_URL`:
     ```text
     postgresql+asyncpg://postgres.ddkeoxomfypnoqdcxwxa:Tckzeros.11@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
     ```
   - `GOOGLE_API_KEY`: Key Gemini của bạn.
   - `OPENAI_API_KEY`: Key OpenAI (nếu có, hoặc bỏ qua nếu dùng Google).
   - `CORS_ORIGINS`: Tạm thời để `*` hoặc điền domain Vercel sau khi tạo ở Bước 3.
6. Bấm **Apply**. Render sẽ build Docker image và khởi động service tại domain:
   `https://vinfast-ai-backend.onrender.com`

### Cách 2: Tạo thủ công qua Render Web Service UI
1. Vào [Render Dashboard](https://dashboard.render.com/) -> Bấm **New +** -> **Web Service**.
2. Chọn repo `AI20K-Build-Phase-Cohort-4/P-097`.
3. Cấu hình thông tin:
   - **Name**: `vinfast-ai-backend`
   - **Region**: `Singapore (Southeast Asia)`
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: `Free`
4. Tại mục **Environment Variables**, thêm:
   | Biến | Giá trị |
   |------|---------|
   | `APP_ENV` | `production` |
   | `DATABASE_URL` | `postgresql+asyncpg://postgres.ddkeoxomfypnoqdcxwxa:Tckzeros.11@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` |
   | `LLM_PROVIDER` | `google` |
   | `GOOGLE_API_KEY` | *(Khóa Gemini API của bạn)* |
   | `CORS_ORIGINS` | `*` *(hoặc domain frontend Vercel)* |
5. Bấm **Create Web Service**. Kiểm tra endpoint health: `https://<tên-app>.onrender.com/health` trả về `{"status":"ok"}` là thành công!

---

## 3. 🌐 Bước 3: Triển Khai Frontend lên Vercel

Frontend được viết bằng Next.js 15 nằm trong thư mục [frontend/](file:///c:/Users/Vxtor/Documents/workspace/P-097/frontend).

### Cách 1: Triển khai qua Vercel Dashboard (Khuyên dùng)
1. Truy cập [Vercel Dashboard](https://vercel.com/new).
2. Bấm **Import** repository `AI20K-Build-Phase-Cohort-4/P-097`.
3. **CẤU HÌNH QUAN TRỌNG NHẤT (Root Directory)**:
   - Bấm nút **Edit** cạnh mục **Root Directory**.
   - Chọn hoặc gõ: `frontend`.
   - Vercel sẽ tự động phát hiện Framework: **Next.js**.
4. Cấu hình **Environment Variables**:
   | Tên biến | Giá trị | Ghi chú |
   |----------|---------|---------|
   | `NEXT_PUBLIC_API_URL` | `https://vinfast-ai-backend.onrender.com/api/v1` | URL backend vừa tạo ở Bước 2 |
5. Bấm **Deploy**.
   Vercel sẽ tự động cài package, build standalone bundle và cung cấp domain:
   `https://p-097-vinfast.vercel.app` (hoặc domain tương đương).

### Cách 2: Triển khai nhanh bằng Vercel CLI
Tại thư mục gốc dự án:
```powershell
# Chuyển vào thư mục frontend
cd frontend

# Đăng nhập và deploy lên Vercel
npx vercel --prod
```
- Khi Vercel hỏi:
  - *Set up and deploy?* -> `Y`
  - *Which scope?* -> Chọn account của bạn
  - *Link to existing project?* -> `N`
  - *Project name?* -> `vinfast-ai-app`
  - *In which directory is your code located?* -> `./` (vì đang ở trong thư mục `frontend`)
  - *Want to modify settings?* -> `N`

---

## 4. 🔄 Bước 4: Đồng Bộ CORS Sau Khi Triển Khai

Sau khi Vercel cấp domain chính thức cho frontend (ví dụ `https://p-097-vinfast.vercel.app`):
1. Mở Render Dashboard -> Chọn service `vinfast-ai-backend`.
2. Vào mục **Environment** -> Cập nhật:
   ```text
   CORS_ORIGINS=https://p-097-vinfast.vercel.app,http://localhost:3000
   ```
3. Render sẽ tự động trigger deploy lại trong 30 giây để cập nhật chính sách bảo mật CORS.

---

## 5. ✅ Bảng Kiểm Tra Sau Triển Khai (Checklist)

- [x] **Supabase**: Bảng dữ liệu và giá xe, khuyến mãi, chi phí lăn bánh đã được nạp đầy đủ.
- [ ] **Render**: Endpoint `https://<render-backend>/health` trả về `{"status":"ok","env":"production"}`.
- [ ] **Render**: Truy cập `https://<render-backend>/docs` mở được tài liệu Swagger API.
- [ ] **Vercel**: Giao diện website tải mượt mà tại `https://<vercel-domain>`.
- [ ] **End-to-End**: Thử chat với AI Agent hoặc cấu hình dự toán xe trên giao diện Vercel, kiểm tra dữ liệu phản hồi mượt mà từ backend Render và Supabase.
