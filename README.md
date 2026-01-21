## Jira Sync Service

Service nền Node.js/TypeScript đồng bộ 2 Jira project:
- Project vận hành (user-facing): log ý kiến, bug, comment của user, là căn cứ trả lời user.
- Project phát triển: nhận issue từ project vận hành, xử lý và trả kết quả ngược về project vận hành.

### Tài liệu quy trình
- Sơ đồ luồng và vai trò vận hành: [Workflow](Workflow.md).
- Khuyến nghị đọc trước khi cấu hình/chạy để hiểu rõ điểm chạm giữa User Project và Dev Project.

### Yêu cầu
- Node.js 18+
- MongoDB đang chạy và có quyền tạo DB

### Setup
- Cài dependency: `npm install`
- Tạo file env: `cp .env.example .env` và điền các giá trị `JIRA_*`, `USER_PROJECT_KEY`, `DEV_PROJECT_KEY`, `DATABASE_URL`, `DATABASE_NAME`, `SYNC_INTERVAL_MINUTES`
  - `JIRA_AUTH_TYPE=basic` (mặc định) dùng email + API token Jira Cloud
  - Nếu Jira Data Center/SAML chặn basic, đặt `JIRA_AUTH_TYPE=pat` và dùng Personal Access Token vào `JIRA_API_TOKEN`
  - `LOG_PRETTY=true` (tùy chọn) nếu muốn log text dễ đọc; để trống/false khi deploy production
- Kết nối MongoDB không cần migrate; service tự tạo collection khi ghi dữ liệu

### Chạy service
- Dev (ts-node ESM): `npm start`
- Production build: `npm run build` rồi `node dist/index.js`
- Chạy quét trạng thái ban đầu (không tạo issue Dev, chỉ lưu trạng thái project vận hành): `npm run sync:init`
- Docker:
  - Build image: `docker build -t jira-sync .`
  - Chạy bằng docker compose (kèm MongoDB): `docker-compose up -d`
  - Cấu hình môi trường: đặt `.env` với `JIRA_*`, `USER_PROJECT_KEY`, `DEV_PROJECT_KEY`; compose sẽ override `DATABASE_URL` trỏ đến service `mongo`

### Kiểm thử thủ công
- Trạng thái Project vận hành → Project phát triển:
  - Tạo issue ở project vận hành, chuyển sang `In Progress`
  - Chờ scheduler (mặc định 5 phút) hoặc chạy lại service; kiểm tra project phát triển có issue Bug mới, description có dòng `Link: <URL tới issue user>`, comment được ghi ở project vận hành, description issue user được append link tới issue Dev và mapping có trong DB
- Trạng thái Project phát triển → Project vận hành:
  - Lấy issue mapping, chuyển issue project phát triển sang `Done`
  - Sau chu kỳ sync, kiểm tra project vận hành được comment `Lỗi đã được xử lý tại issue DEV-xxx`, status chuyển `Resolved` (nếu chưa Resolved/Closed), field `replied` = true và description issue Dev có dòng link tới issue user nếu còn thiếu

### Cấu trúc chính
- `src/config`: load env, logger
- `src/jira`: Jira REST client + wrapper cho từng project
- `src/sync`: luồng đồng bộ hai chiều
- `src/db`: Mongoose models và repository
- `src/scheduler.ts`: cron theo `SYNC_INTERVAL_MINUTES`

### Deployment

Xem [DEPLOY.md](DEPLOY.md) để biết hướng dẫn triển khai lên server Ubuntu với kiến trúc consolidated (1 container, nhiều workers).
