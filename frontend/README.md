# AutoQuote AI — Frontend

Giao diện Next.js 16 cho cấu hình xe, chat tư vấn và dashboard demo. Backend FastAPI và database PostgreSQL được triển khai riêng; frontend không gọi Supabase Data API trực tiếp.

## Chạy local

Từ thư mục `frontend`, với Node.js 20.9+:

```bash
npm ci
cp .env.example .env.local
# PowerShell: Copy-Item .env.example .env.local
npm run dev
```

`BACKEND_URL=http://localhost:8000` trong `.env.local` là URL server-side, không kèm `/api/v1`. Proxy `/api/chat` và `/api/vehicles` tự thêm prefix. Mở http://localhost:3000; backend và database phải khởi động theo [README dự án](../README.md).

Không đặt database password, key AI hoặc key Supabase quản trị vào frontend environment. Đăng nhập và dashboard hiện dùng mock; chưa có phân quyền production hoàn chỉnh.

## Kiểm tra và deploy

```bash
npm run lint
npm run build
```

Vercel Root Directory = `frontend`, framework Next.js. Đặt `BACKEND_URL=https://<backend-domain>` cho Production/Preview phù hợp rồi tạo deployment mới. Làm tuần tự theo [guide duy nhất: public website và vận hành](../docs/CLOUD_DEPLOYMENT.md), gồm Supabase, Render, Vercel và kiểm tra quyền truy cập ẩn danh.
