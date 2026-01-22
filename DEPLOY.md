# Hướng dẫn triển khai Jira Sync lên Server

Tài liệu này hướng dẫn triển khai Jira Sync Service trên server Ubuntu với kiến trúc consolidated (1 container, nhiều workers).

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Chuẩn bị Server](#2-chuẩn-bị-server)
3. [Cấu hình GitHub Container Registry](#3-cấu-hình-github-container-registry)
4. [Clone và cấu hình](#4-clone-và-cấu-hình)
5. [Cấu hình môi trường](#5-cấu-hình-môi-trường)
6. [Cấu hình Sync Rules](#6-cấu-hình-sync-rules)
7. [Triển khai](#7-triển-khai)
8. [Giám sát và bảo trì](#8-giám-sát-và-bảo-trì)
9. [Thêm Worker mới](#9-thêm-worker-mới)
10. [Xử lý sự cố](#10-xử-lý-sự-cố)
11. [Quick Reference](#11-quick-reference)

---

## 1. Tổng quan

### 1.1 Kiến trúc Consolidated

Jira Sync chạy với **1 container duy nhất** sử dụng Node.js child processes để chạy nhiều sync workers. Mỗi worker:
- Có cấu hình sync rules riêng
- Sử dụng database riêng trên MongoDB chia sẻ
- Có scheduler độc lập

```
┌─────────────────────────────────────────────────────────────────┐
│                    jira-sync Container (1)                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Main Process                             │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │   │
│  │  │ Config      │ │ Process     │ │ Health      │        │   │
│  │  │ Loader      │ │ Manager     │ │ Server      │        │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
│           │                   │                   │             │
│           ▼                   ▼                   ▼             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Child Processes (Workers)                   │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │   │
│  │  │ Worker AB   │ │ Worker CD   │ │ Worker XY   │        │   │
│  │  │ DB: sync_ab │ │ DB: sync_cd │ │ DB: sync_xy │        │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           │
           │ DATABASE_URL=mongodb://mongo:27017
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    mongo Container (1)                           │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ sync_ab     │ │ sync_cd     │ │ sync_xy     │  <- Databases │
│  │ (Database)  │ │ (Database)  │ │ (Database)  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Ưu điểm

| Tiêu chí | Giá trị |
|----------|---------|
| Containers | 1 sync + 1 MongoDB |
| Memory | Tiết kiệm (O(1) thay vì O(N)) |
| Disk | 1 volume thay vì N volumes |
| Cấu hình | Đơn giản, dễ quản lý |

### 1.3 Các thành phần chính

| Thành phần | Mô tả |
|------------|-------|
| `docker-compose.yml` | Docker Compose file |
| `.env` | File biến môi trường (infrastructure, không chứa JIRA credentials) |
| `config/sync-*.json` | File cấu hình cho từng worker (chứa JIRA credentials) |

---

## 2. Chuẩn bị Server

Hướng dẫn này được viết cho **Ubuntu 20.04/22.04/24.04**.

### 2.1 Cập nhật hệ thống

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Cài đặt Docker Engine

```bash
# Cài đặt các dependency
sudo apt install -y ca-certificates curl gnupg lsb-release

# Thêm GPG key của Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Thêm repository Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Cài đặt Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Thêm user vào group docker
sudo usermod -aG docker $USER

# Kích hoạt và khởi động Docker
sudo systemctl enable docker
sudo systemctl start docker
```

**Lưu ý:** Đăng xuất và đăng nhập lại để group membership được áp dụng.

### 2.3 Xác nhận Docker đã cài đặt

```bash
docker --version
docker compose version
```

### 2.4 Cấu hình UFW Firewall

```bash
# Cài đặt UFW nếu chưa có
sudo apt install -y ufw

# Cho phép SSH (quan trọng để tránh lockout)
sudo ufw allow 22/tcp

# Bật firewall
sudo ufw enable
```

---

## 3. Cấu hình GitHub Container Registry

### 3.1 Tạo GitHub Personal Access Token (PAT)

1. Truy cập: **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Nhấn **Generate new token (classic)**
3. Đặt tên gợi nhớ (ví dụ: `docker-registry`)
4. Chọn scope: `read:packages`, `write:packages`, `delete:packages`
5. **Lưu lại token ngay** (sẽ không hiển thị lại)

### 3.2 Login vào GHCR

```bash
export GHCR_USERNAME="your-github-username"
export GHCR_TOKEN="ghp_your-personal-access-token"

echo $GHCR_TOKEN | docker login ghcr.io -u $GHCR_USERNAME --password-stdin
```

### 3.3 Build và Push Image

```bash
# Build Docker image
docker build -t jira-sync:latest .

# Tag image với định dạng GHCR
docker tag jira-sync:latest ghcr.io/$GHCR_USERNAME/jira-sync:latest

# Push lên GHCR
docker push ghcr.io/$GHCR_USERNAME/jira-sync:latest
```

### 3.4 Cập nhật docker-compose.yml

Chỉnh sửa `docker-compose.yml`, thay đổi image line:

```yaml
services:
  jira-sync:
    image: ghcr.io/$GHCR_USERNAME/jira-sync:latest
    # ... phần còn lại giữ nguyên
```

---

## 4. Clone và Cấu hình

### 4.1 Clone Repository

```bash
git clone https://github.com/your-username/jira-sync.git
cd jira-sync
```

### 4.2 Tạo cấu trúc thư mục

```bash
mkdir -p config
```

### 4.3 Copy các file cấu hình

```bash
cp .env.example .env
cp config/sync-rules.example.json config/sync-ab.json
cp config/sync-rules.example.json config/sync-cd.json
```

---

## 5. Cấu hình môi trường

```bash
nano .env
```

### 5.1 Cấu hình chung

```bash
# Log level: debug, info, warn, error
LOG_LEVEL=info

# Port cho health check server
PORT=3000

# Database URL (MongoDB instance - dùng chung cho tất cả workers)
DATABASE_URL=mongodb://mongo:27017

# Sync interval (mặc định, có thể override trong từng worker config)
SYNC_INTERVAL_MINUTES=5
```

> **Lưu ý về Database:**
> - `DATABASE_URL` cấu hình MongoDB instance (global, dùng chung)
> - `DATABASE_NAME` **KHÔNG** cấu hình trong .env - mỗi worker tự động sử dụng database riêng với tên `<worker_name>_sync`
> - Ví dụ: worker `sync-ab` sử dụng database `sync_ab`, worker `sync-cd` sử dụng database `sync_cd`

### 5.2 Cấu hình JIRA Credentials

JIRA credentials được cấu hình trong file JSON. Xem [Section 6](#6-cấu-hình-sync-rules).

### 5.3 Cách lấy Jira API Token

1. Đăng nhập: https://id.atlassian.com/manage-profile/security/api-tokens
2. Nhấn **Create API token**
3. Đặt tên mô tả
4. **Copy token ngay** và dán vào file JSON config (`config/sync-*.json`)

---

## 6. Cấu hình Sync Rules

### 6.1 Cấu hình cho Worker AB

```bash
nano config/sync-ab.json
```

```json
{
  "name": "sync-ab",
  "description": "Sync configuration for Project A ↔ Project B",
  "jira": {
    "baseUrl": "https://your-domain.atlassian.net",
    "email": "bot@your-domain.com",
    "apiToken": "your-jira-api-token",
    "authType": "pat"
  },
  "userProjectKey": "USER-A",
  "devProjectKey": "DEV-A",
  "syncIntervalMinutes": 5,
  "defaultBehavior": {
    "syncAttachments": true,
    "addCrossLinks": true,
    "onlyOnStatusChange": true,
    "skipIntermediateStatuses": true
  },
  "rules": [
    {
      "id": "user-will-do",
      "sourceStatus": "Will Do",
      "targetProject": "dev",
      "syncDirection": "user_to_dev",
      "enabled": true,
      "priority": 1,
      "actions": {
        "createIssue": true,
        "syncAttachments": true,
        "addCrossLink": true,
        "addComment": true,
        "commentTemplate": "Đã tạo Dev Issue: ${targetKey}"
      }
    }
  ]
}
```

### 6.2 Cấu hình cho Worker CD

```bash
nano config/sync-cd.json
```

```json
{
  "name": "sync-cd",
  "description": "Sync configuration for Project C ↔ Project D",
  "jira": {
    "baseUrl": "https://other-domain.atlassian.net",
    "email": "bot@other-domain.com",
    "apiToken": "different-api-token",
    "authType": "pat"
  },
  "userProjectKey": "USER-C",
  "devProjectKey": "DEV-C",
  "syncIntervalMinutes": 10,
  ...
}
```

> **Quan trọng:** Mỗi worker có thể kết nối đến **Jira instance khác nhau** với credentials riêng. Điều này cho phép sync từ nhiều Jira projects khác nhau trong cùng một container.

---

## 7. Triển khai

### 7.1 Build và Push Image (nếu dùng GHCR)

```bash
docker build -t jira-sync:latest .
docker tag jira-sync:latest ghcr.io/$GHCR_USERNAME/jira-sync:latest
docker push ghcr.io/$GHCR_USERNAME/jira-sync:latest
```

### 7.2 Khởi động Containers

```bash
# Khởi động
docker-compose up -d

# Hoặc build lại image trước khi chạy
docker-compose up -d --build
```

### 7.3 Kiểm tra trạng thái

```bash
docker-compose ps

# Kết quả mong đợi:
#   Name                   State           Ports
#  ----------------------------------------------------------------
#  jira-sync              Up              3000/tcp
#  mongo                  Up              27017/tcp
```

### 7.4 Xem logs

```bash
# Logs real-time
docker logs -f jira-sync

# Logs 100 dòng cuối
docker logs --tail 100 jira-sync
```

### 7.5 Kiểm tra Health

```bash
curl http://localhost:3000/health

# Kết quả mong đợi:
{
  "status": "healthy",
  "workers": [
    {"name": "sync-ab", "status": "running", "lastHeartbeat": "..."},
    {"name": "sync-cd", "status": "running", "lastHeartbeat": "..."}
  ],
  "timestamp": "..."
}
```

---

## 8. Giám sát và Bảo trì

### 8.1 Xem logs theo Worker

```bash
# Xem logs real-time
docker logs -f jira-sync

# Logs từ 1 giờ trước
docker logs --since 1h jira-sync
```

### 8.2 Kiểm tra Health Status

```bash
curl http://localhost:3000/health
```

### 8.3 Kiểm tra tài nguyên

```bash
docker stats
```

### 8.4 Backup MongoDB

#### Backup thủ công

```bash
mkdir -p backups/$(date +%Y%m%d)

# Backup worker AB
docker exec mongo mongodump --db sync_ab --out /backup/
docker cp mongo:/backup/sync_ab ./backups/$(date +%Y%m%d)/

# Backup worker CD
docker exec mongo mongodump --db sync_cd --out /backup/
docker cp mongo:/backup/sync_cd ./backups/$(date +%Y%m%d)/
```

#### Backup tự động với cron

```bash
crontab -e

# Thêm dòng sau để backup mỗi ngày lúc 2:00 AM
0 2 * * * docker exec mongo mongodump --db sync_ab --out /backup/daily/ && \
  docker cp mongo:/backup/daily ./backups/ab_$(date +\%Y\%m\%d) 2>/dev/null
```

### 8.5 Restore từ Backup

```bash
# Restore worker AB
docker cp ./backups/sync_ab/. mongo:/backup/
docker exec mongo mongorestore --db sync_ab --drop /backup/sync_ab
```

### 8.6 Cập nhật phiên bản mới

```bash
git pull
docker build -t jira-sync:latest .
docker tag jira-sync:latest ghcr.io/$GHCR_USERNAME/jira-sync:latest
docker push ghcr.io/$GHCR_USERNAME/jira-sync:latest
docker pull ghcr.io/$GHCR_USERNAME/jira-sync:latest
docker-compose down
docker-compose up -d
```

---

## 9. Thêm Worker mới

Ví dụ: Thêm worker XY để sync USER-X ↔ DEV-X.

### 9.1 Bước 1: Tạo file cấu hình

```bash
cp config/sync-rules.example.json config/sync-xy.json
nano config/sync-xy.json
```

```json
{
  "name": "sync-xy",
  "description": "Sync configuration for Project X ↔ Project Y",
  "jira": {
    "baseUrl": "https://x-domain.atlassian.net",
    "email": "bot@x-domain.com",
    "apiToken": "api-token-for-xy",
    "authType": "pat"
  },
  "userProjectKey": "USER-X",
  "devProjectKey": "DEV-X",
  "syncIntervalMinutes": 5,
  ...
}
```

### 9.2 Bước 2: Restart container

```bash
docker-compose restart jira-sync
```

### 9.3 Bước 3: Kiểm tra

```bash
curl http://localhost:3000/health
```

---

## 10. Xử lý sự cố

### 10.1 Container không khởi động

```bash
# Xem logs chi tiết
docker logs jira-sync

# Kiểm tra trạng thái container
docker inspect jira-sync
```

### 10.2 Lỗi kết nối Jira

```bash
# Xem logs tìm lỗi
docker logs jira-sync 2>&1 | grep -i "jira\|auth\|token"

# Kiểm tra credentials trong config file
cat config/sync-ab.json | grep -A5 '"jira"'

# Test kết nối với credentials từ config
curl -u "email:token" "https://your-domain.atlassian.net/rest/api/3/project"
```

### 10.3 Lỗi kết nối MongoDB

```bash
# Kiểm tra MongoDB container
docker logs mongo

# Test kết nối
docker exec -it jira-sync sh -c "nc -zv mongo 27017"
```

### 10.4 Sync không hoạt động

```bash
# Kiểm tra scheduler trong logs
docker logs jira-sync 2>&1 | grep -i "scheduler\|sync.*cycle"

# Kiểm tra health endpoint
curl http://localhost:3000/health

# Xem chi tiết config trong container
docker exec jira-sync cat /app/config/sync-ab.json
```

---

## 11. Quick Reference

### 11.1 Các lệnh thường dùng

```bash
# Khởi động
docker-compose up -d

# Khởi động với rebuild
docker-compose up -d --build

# Dừng
docker-compose down

# Xem trạng thái
docker-compose ps

# Xem logs
docker logs -f jira-sync

# Restart
docker-compose restart

# Xóa tất cả (bao gồm volumes!)
docker-compose down -v
```

### 11.2 Kiểm tra và debug

```bash
# Health check
curl http://localhost:3000/health

# Resource usage
docker stats

# Vào container để debug
docker exec -it jira-sync sh

# Kiểm tra config
docker exec jira-sync cat /app/config/sync-ab.json
```

### 11.3 Backup và Restore

```bash
# Backup
docker exec mongo mongodump --db sync_ab --out /backup/
docker cp mongo:/backup/sync_ab ./backups/

# Restore
docker cp ./backups/sync_ab/. mongo:/backup/
docker exec mongo mongorestore --db sync_ab --drop /backup/sync_ab
```

### 11.4 Cập nhật

```bash
git pull
docker-compose up -d --build
```

---

## 12. Migration từ cấu hình env vars cũ

Nếu bạn đang sử dụng phiên bản cũ với JIRA credentials trong `.env`, hãy migrate sang cấu hình file JSON.

### 12.1 Bước 1: Tạo file config từ env vars

Tạo file `config/sync-default.json` với nội dung sau (lấy giá trị từ `.env` cũ):

```json
{
  "name": "sync-default",
  "description": "Default sync configuration migrated from env vars",
  "jira": {
    "baseUrl": "https://your-domain.atlassian.net",
    "email": "bot@your-domain.com",
    "apiToken": "your-jira-api-token",
    "authType": "pat"
  },
  "userProjectKey": "YOUR-USER-PROJECT-KEY",
  "devProjectKey": "YOUR-DEV-PROJECT-KEY",
  "syncIntervalMinutes": 5
}
```

### 12.2 Bước 2: Cập nhật .env

Xóa các dòng JIRA credentials khỏi `.env`:

```bash
# Xóa các dòng này:
# JIRA_AUTH_TYPE=pat
# JIRA_BASE_URL=...
# JIRA_EMAIL=...
# JIRA_API_TOKEN=...
# USER_PROJECT_KEY=...
# DEV_PROJECT_KEY=...
```

### 12.3 Bước 3: Restart service

```bash
docker-compose down
docker-compose up -d
```

### 12.4 Bước 4: Kiểm tra

```bash
curl http://localhost:3000/health
```

---

## Liên hệ hỗ trợ

Nếu gặp vấn đề không có trong tài liệu này:
1. Xem logs: `docker logs jira-sync`
2. Kiểm tra health: `curl http://localhost:3000/health`
3. Tạo issue trên GitHub repository

---

**Cập nhật lần cuối:** Tháng 1 năm 2026
