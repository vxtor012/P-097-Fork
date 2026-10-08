# Sổ tay vận hành AutoQuote AI

Dành cho người tiếp quản hệ thống mà không cần biết lịch sử phát triển. Deploy lần đầu theo [cloud deploy](CLOUD_DEPLOYMENT.md); tạo/nâng cấp database theo [Supabase database guide](SUPABASE_DATABASE_GUIDE.md). Các lệnh Docker chạy từ thư mục gốc. CLI database xem hướng dẫn PG trong tài liệu Supabase.

## 1. Thông tin cần có khi tiếp quản

Lưu vào hồ sơ vận hành riêng, không commit bí mật:

| Thông tin | Nơi lấy |
| --- | --- |
| Repository, branch, commit đang chạy | Git và lịch sử deployment |
| Backend URL, service ID, region, plan | Render Dashboard |
| Frontend URL, project, Production/Preview | Vercel Dashboard |
| Database project ref, region, host/port/user | Supabase Dashboard → Connect |
| Provider/model chat, nơi quản lý key | Render Environment hoặc `.env` local |
| Phiên bản catalog PostgreSQL/Gold/frontend | SQL `price_version`, commit dữ liệu |
| Backup gần nhất, nơi lưu, lần thử restore | Hồ sơ backup |
| Người có quyền xử lý sự cố, kênh liên hệ | Quản trị tài khoản triển khai |

Nếu chưa có quyền vào một dịch vụ, yêu cầu quản trị cấp quyền cho tài khoản của mình; không dùng key/tài khoản cá nhân người triển khai trước.

## 2. Kiểm tra đầu ca và sau mỗi thay đổi

1. Xem Render/Vercel deployment đang chạy có đúng commit.
2. GET backend `/health`: status OK chỉ xác nhận tiến trình chạy.
3. GET backend `/api/v1/vehicles`: HTTP 200 và catalog không rỗng mới kiểm tra được đọc database.
4. GET frontend `/api/vehicles`: xác nhận proxy đến đúng backend.
5. Mở configurator, thử cấu hình đã có số tiền chuẩn để đối chiếu.
6. Chat hỏi giá/phí và một câu kiến thức để kiểm tra riêng công cụ CSV và RAG.
7. Xem log backend/frontend, lỗi DB, lỗi key/model/quota; xem CPU/memory/connections database và mức sử dụng tài khoản AI.

Bash:

```bash
curl --fail-with-body https://<backend-domain>/health
curl --fail-with-body https://<backend-domain>/api/v1/vehicles
curl --fail-with-body https://<frontend-domain>/api/vehicles
```

PowerShell dùng `curl.exe` cho lệnh curl ở tài liệu. Kiểm tra chat qua UI hoặc Swagger `/docs` với JSON:

```json
{"session_id":"ops-smoke-test","message":"VF 6 Plus giá bao nhiêu?"}
```

Smoke test AI có thể tiêu thụ quota. Không dùng thông tin khách hàng thật cho câu hỏi thử. Một HTTP 200 chat chưa chứng minh số tiền hoặc RAG đúng; đọc nội dung và đối chiếu nguồn.

## 3. Chạy và quản trị Docker local

### Khởi tạo

```bash
docker --version
docker compose version
```

Tạo `.env` từ `.env.example`, điền key, chọn provider/model. PostgreSQL local và mật khẩu Compose chỉ phục vụ demo local. Backend Compose dùng `DOCKER_DATABASE_URL` nếu có; `DATABASE_URL` dành cho backend chạy trực tiếp trên máy. Redis có trong Compose nhưng ứng dụng hiện chưa dùng cache/broker.

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 backend frontend postgres
```

URL local: frontend 3000, backend 8000, PostgreSQL 5432. Dữ liệu postgres nằm trong named volume. Database mới được init bằng schema/seed đã sửa, gồm index và RLS. Database/volume đã tồn tại không tự nhận schema mới; dùng runner nâng cấp theo database guide. Nếu postgres init lỗi, không tự xóa volume: kiểm tra log và liệu đã có dữ liệu cần giữ.

### Nâng cấp database local hoặc Supabase

Backend chạy trên máy: đặt `DATABASE_URL` host `localhost`. Supabase: đặt `MIGRATION_DATABASE_URL` admin direct/session pooler trong `.env`. Runner chạy trên máy có dependencies, không chạy trong Docker image production:

```bash
python scripts/db/migrate_supabase.py check
python scripts/db/migrate_supabase.py upgrade
python scripts/db/migrate_supabase.py check
```

Backup trước upgrade theo database guide. `check` chỉ đọc; schema cũ có thể exit 1 trước upgrade. Upgrade không seed và không đổi giá/leads/quotes. Đổi target phải đối chiếu host được script in ra trước thao tác.

Database trống ngoài Compose: dùng `bootstrap`, thêm `--seed` nếu cần demo ngay lần đầu. Database Compose mới đã có bảng thì không bootstrap lại. Nếu volume init dở, kiểm kê các bảng/cột; không xóa volume hoặc chạy seed nhiều lần để chữa lỗi. Thử trên database demo riêng trước khi sửa dữ liệu cần giữ.

### Áp dụng cấu hình mới

Sửa `.env` rồi tạo lại container để nhận environment mới:

```bash
docker compose up -d --force-recreate backend
docker compose up -d --force-recreate frontend
```

`docker compose restart` chỉ restart container cũ, không nạp biến `.env` mới. Nếu sửa code/dependencies hoặc dữ liệu được COPY vào image:

```bash
docker compose up -d --build backend
docker compose up -d --build frontend
```

Các proxy hiện dùng `BACKEND_URL` server-side, không dùng `NEXT_PUBLIC_API_URL`. Khi đổi URL backend kiểm tra giá trị backend trong đúng container/deployment, không sửa CORS thay cho lỗi server-to-server.

### Log và dừng

```bash
docker compose logs --tail=200 backend
docker compose logs -f backend
docker compose down
```

Dùng Ctrl+C để dừng theo dõi log. `down` giữ named volume. Không dùng `down -v` để chữa lỗi schema/seed trên database cần giữ; thao tác đó xóa volume dữ liệu local. Không chạy system prune toàn máy như bước vận hành thường xuyên.

### Test code

Chạy trên máy đã cài dependencies, `.env` với PostgreSQL URL phù hợp:

```bash
python -m pytest
python -m ruff check src tests
cd frontend
npm ci
npm run lint
npm run build
```

Image backend production không COPY `tests/` nên không chạy `pytest tests/` trong container đó.

## 4. Release cloud và rollback

1. Ghi commit hiện tại, commit đích, thay đổi env, schema, dữ liệu và thời gian bảo trì nếu có.
2. Backup trước thay đổi database/dữ liệu; thử trên staging.
3. Tắt/kiểm soát auto-deploy khi migration yêu cầu thứ tự. Blueprint hiện có `autoDeploy: true`, push có thể kích hoạt deploy ngay.
4. Áp dụng schema tương thích ngược trước backend mới; xác nhận dữ liệu theo Supabase guide. `create_all()` không nâng cấp bảng hiện có.
5. Render deploy đúng commit; xem build/runtime log, `/health` và `/api/v1/vehicles`.
6. Vercel deploy frontend tương ứng, kiểm tra proxy và UI.
7. Chạy smoke test mục 2; ghi kết quả và mở lại thao tác ghi nếu đã bảo trì.

Nếu lỗi ứng dụng, deploy lại commit/backend và deployment/frontend trước đó bằng Dashboard. Giữ cột nullable vừa thêm nếu code cũ vẫn tương thích. Rollback code không rollback dữ liệu; nếu dữ liệu bị sai, theo quy trình phục hồi database, không reset DB. Các secret/env đã đổi cần khôi phục giá trị phù hợp từ kho bí mật, vì rollback deployment không bảo đảm đảo mọi cấu hình.

## 5. Backup và thử phục hồi

Trước release DB và theo lịch của người vận hành, export dump bằng mục 3 Supabase guide. Không dựa vào `/health` để xác nhận backup. Tối thiểu kiểm tra file có thể liệt kê bằng `pg_restore --list`; định kỳ thử restore vào database staging trống rồi chạy kiểm tra schema/số dòng/API.

Bản backup phải có: thời điểm và múi giờ, project ref, commit, phạm vi schema, checksum, nơi lưu và kết quả restore gần nhất. Backup `public` không bao gồm file Storage/Auth, và `--no-acl` không giữ grants. Kiểm tra quyền/RLS lại khi restore. Người quản trị đặt thời gian mất dữ liệu tối đa chấp nhận được và thời gian phục hồi mục tiêu để quyết định lịch backup.

Không commit dump vào repo. Nếu dùng backup Dashboard/PITR, xác nhận quyền lợi plan, retention và thời điểm backup thực tế theo [Supabase backups](https://supabase.com/docs/guides/platform/backups).

## 6. Cập nhật model, key và dữ liệu

| Thay đổi | Thao tác cần làm |
| --- | --- |
| OpenAI chat model | Đổi `MODEL_NAME`, restart/redeploy, kiểm tra chat/tool calling |
| Google chat model | Đổi `GOOGLE_MODEL_NAME`, đặt `LLM_PROVIDER=google`, kiểm tra quyền model |
| Key AI | Tạo key mới, cập nhật secret, redeploy, kiểm tra chat/RAG rồi thu hồi key cũ |
| Password DB | Đổi có kế hoạch, cập nhật URL đã encode trên các môi trường, redeploy và kiểm tra catalog |
| Giá/phí PostgreSQL | Backup, cập nhật transaction/version, đối chiếu số tiền API |
| Catalog/knowledge Gold | Kiểm tra dữ liệu, cập nhật corpus tương ứng, rebuild backend, kiểm tra chat |
| Embedding model | Cần tạo lại corpus và cập nhật retrieval; không đổi chỉ bằng biến chat model |

Khi có cả hai key, `auto` ưu tiên OpenAI chat. Google chat vẫn cần OpenAI key để RAG embedding. Settings, LLM và corpus được cache trong tiến trình nên cần tiến trình mới sau thay đổi.

Xem mục 7 Supabase guide để đồng bộ các nguồn giá. Seed chứa snapshot 2025, không phải bảng giá đang áp dụng hôm nay. Không tự gia hạn khuyến mãi chỉ để có kết quả test.

## 7. Chẩn đoán sự cố

| Triệu chứng | Kiểm tra theo thứ tự | Xác nhận phục hồi |
| --- | --- | --- |
| Frontend không tải | Vercel deployment/build log, đúng domain/env | Trang mở và proxy catalog trả 200 |
| Health OK, catalog 500 | Log DB, URL/user/password, network, thiếu `image_url`/`roof_hex`, schema | API catalog trả không rỗng |
| Catalog rỗng nhưng UI có xe | DB chưa seed; frontend có fallback local | Đối chiếu catalog API với SQL |
| Chat lỗi | Render log, provider/key/model/quota, kết nối AI | Chat có nội dung đúng và tool gọi được |
| RAG không trả nguồn | OpenAI key, embedding quota, file Gold | Câu kiến thức truy xuất được corpus |
| Prepared statement lỗi | Pooler mode và cache, phiên bản asyncpg/SQLAlchemy | Request lặp lại không lỗi |
| Giá trùng hoặc sai | SQL bản giá mở, seed bị chạy nhiều lần, PostgreSQL/Gold/frontend lệch | Cấu hình mẫu có số tiền thống nhất |
| Ưu đãi không xuất hiện | Ngày bắt đầu/kết thúc, active, điều kiện model/tỉnh | Chính sách hợp lệ hiện đúng |
| Mất lịch sử chat sau restart | MemorySaver chỉ trong tiến trình | Tạo session mới; chưa có checkpoint bền vững |
| Dashboard không phản ánh DB | Trang đang dùng mock | Đây chưa phải luồng dữ liệu thật |
| PDF URL không tải | Endpoint mới placeholder, chưa có generator/file | Cần triển khai chức năng, không phải lỗi proxy |

Khi xử lý: ghi thời điểm, commit, endpoint, HTTP status, lỗi rút gọn; không gửi toàn bộ env, password, key hoặc dữ liệu khách hàng trong log chia sẻ. Không retry liên tục lỗi authentication, schema hoặc cú pháp SQL.

## 8. Giới hạn cần biết

- Bảng DB đã bật RLS và thu hồi quyền anon/authenticated; truy cập qua backend owner/admin. Các INFO RLS không policy/index chưa dùng không tự biến thành lỗi cần mở quyền.
- Auth frontend là mock; API ghi dữ liệu chưa có kiểm soát quyền đầy đủ. Chưa vận hành với dữ liệu khách hàng thật.
- MemorySaver mất hội thoại khi restart, không chia sẻ giữa nhiều worker/instance.
- Pool backend có `pool_size=10`, `max_overflow=20` mỗi tiến trình; tính tổng khi tăng số instance.
- Health là liveness, chưa phải readiness database/AI.
- Docker chỉ copy `src/`, `dataset/`; fallback web lookup dưới `data/vinfast_agent` chưa được đóng gói.
- Docker HEALTHCHECK dùng port 8000, còn CMD dùng `PORT`; kiểm tra health của nền tảng theo cổng thực tế nếu override `PORT`.
