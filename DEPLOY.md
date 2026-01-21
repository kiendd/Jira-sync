# Hướng dẫn triển khai Jira Sync lên Server

Tài liệu này hướng dẫn triển khai Jira Sync Service với cấu hình multi-instance trên server Ubuntu.

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Chuẩn bị Server](#2-chuẩn-bị-server)
3. [Cấu hình GitHub Container Registry](#3-cấu-hình-github-container-registry)
4. [Clone và cấu hình](#4-clone-và-cấu-hình)
5. [Cấu hình môi trường](#5-cấu-hình-môi-trường)
6. [Cấu hình Sync Rules](#6-cấu-hình-sync-rules)
7. [Triển khai](#7-triển-khai)
8. [Giám sát và bảo trì](#8-giám-sát-và-bảo-trì)
9. [Thêm Instance mới](#9-thêm-instance-mới)
10. [Xử lý sự cố](#10-xử-lý-sự-cố)
11. [Quick Reference](#11-quick-reference)

---

## 1. Tổng quan

### 1.1 Multi-instance là gì?

Multi-instance cho phép chạy nhiều Jira Sync instances độc lập trên cùng một server. Mỗi instance:
- Có MongoDB riêng biệt
- Có cấu hình sync rules riêng
- Có thể sync các cặp Jira project khác nhau
- Hoàn toàn cách ly với các instances khác

### 1.2 Khi nào nên dùng multi-instance?

- Khi cần sync nhiều cặp Jira project khác nhau
- Khi muốn cô lập dữ liệu giữa các môi trường (dev/staging/production)
- Khi muốn các instances có thể cấu hình sync rules riêng biệt

### 1.3 Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                         Server Ubuntu                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Docker Network: bridge                   │  │
│  │                   Subnet: 172.28.0.0/16                    │  │
│  │                                                           │  │
│  │  ┌─────────────┐         ┌─────────────┐                  │  │
│  │  │  sync-ab    │         │  sync-cd    │   ← Jira Sync    │  │
│  │  │ Container   │         │ Container   │     Instances    │  │
│  │  └──────┬──────┘         └──────┬──────┘                  │  │
│  │         │                        │                         │  │
│  │  ┌──────┴──────┐         ┌──────┴──────┐                  │  │
│  │  │  mongo-ab   │         │  mongo-cd   │   ← MongoDB       │  │
│  │  │  :27017     │         │  :27017     │     Instances     │  │
│  │  └─────────────┘         └─────────────┘                  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Các thành phần chính

| Thành phần | Mô tả |
|------------|-------|
| `docker-compose.multi.yml` | Docker Compose file cho multi-instance |
| `.env.multi` | File biến môi trường (credentials) |
| `config/sync-*.json` | File cấu hình sync rules cho từng instance |

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

# Thêm user vào group docker (để chạy docker không cần sudo)
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

Kết quả mong đợi:
```
Docker version 24.0.x
Docker Compose version v2.x.x
```

### 2.4 Cấu hình UFW Firewall

```bash
# Cài đặt UFW nếu chưa có
sudo apt install -y ufw

# Cho phép SSH (quan trọng để tránh lockout)
sudo ufw allow 22/tcp

# Cho phép HTTP/HTTPS nếu cần expose web interface
# sudo ufw allow 80/tcp
# sudo ufw allow 443/tcp

# Bật firewall
sudo ufw enable

# Kiểm tra trạng thái
sudo ufw status
```

**Cảnh báo:** Luôn cho phép port 22/tcp trước khi bật UFW để tránh mất kết nối SSH.

---

## 3. Cấu hình GitHub Container Registry

Phần này hướng dẫn đưa Docker image lên GitHub Container Registry (GHCR) để dễ dàng quản lý và deploy.

### 3.1 Tạo GitHub Personal Access Token (PAT)

1. Truy cập: **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Nhấn **Generate new token (classic)**
3. Đặt tên gợi nhớ (ví dụ: `docker-registry`)
4. Chọn scope: `read:packages`, `write:packages`, `delete:packages`
5. Nhấn **Generate token**
6. **Lưu lại token ngay** (sẽ không hiển thị lại)

### 3.2 Login vào GHCR

```bash
# Thay thế USERNAME bằng GitHub username của bạn
export GHCR_USERNAME="your-github-username"
export GHCR_TOKEN="ghp_your-personal-access-token"

echo $GHCR_TOKEN | docker login ghcr.io -u $GHCR_USERNAME --password-stdin
```

### 3.3 Build và Push Image

```bash
# Clone repository (nếu chưa clone)
git clone https://github.com/$GHCR_USERNAME/jira-sync.git
cd jira-sync

# Build Docker image
docker build -t jira-sync:latest .

# Tag image với định dạng GHCR
docker tag jira-sync:latest ghcr.io/$GHCR_USERNAME/jira-sync:latest
docker tag jira-sync:latest ghcr.io/$GHCR_USERNAME/jira-sync:v1.0.0

# Push lên GHCR
docker push ghcr.io/$GHCR_USERNAME/jira-sync:latest
docker push ghcr.io/$GHCR_USERNAME/jira-sync:v1.0.0
```

### 3.4 Cập nhật docker-compose.multi.yml

Chỉnh sửa `docker-compose.multi.yml`, thay đổi image line:

```yaml
services:
  sync-ab:
    image: ghcr.io/$GHCR_USERNAME/jira-sync:latest  # Thay thế bằng username của bạn
    # ... phần còn lại giữ nguyên

  sync-cd:
    image: ghcr.io/$GHCR_USERNAME/jira-sync:latest  # Thay thế bằng username của bạn
    # ... phần còn lại giữ nguyên
```

---

## 4. Clone và Cấu hình

### 4.1 Clone Repository

```bash
# Thay thế URL bằng repository của bạn
git clone https://github.com/your-username/jira-sync.git
cd jira-sync
```

### 4.2 Tạo cấu trúc thư mục

```bash
# Tạo thư mục config nếu chưa có
mkdir -p config

# Kiểm tra cấu trúc
ls -la
```

Cấu trúc thư mục mong đợi:
```
jira-sync/
├── config/
│   ├── sync-rules.example.json
│   ├── sync-ab.json          # Sẽ tạo
│   └── sync-cd.json          # Sẽ tạo
├── docker-compose.multi.yml
├── .env.multi                # Sẽ tạo
└── ...
```

### 4.3 Copy các file cấu hình

```bash
# Copy file môi trường
cp .env.multi.example .env.multi

# Copy file cấu hình sync rules cho từng instance
cp config/sync-rules.example.json config/sync-ab.json
cp config/sync-rules.example.json config/sync-cd.json
```

---

## 5. Cấu hình môi trường

Chỉnh sửa file `.env.multi` với thông tin của bạn:

```bash
nano .env.multi
```

### 5.1 Cấu hình chung (áp dụng cho tất cả instances)

```bash
# Loại xác thực Jira: "basic" (email + token) hoặc "pat" (Personal Access Token)
JIRA_AUTH_TYPE=pat

# Khoảng cách giữa các lần sync (phút)
SYNC_INTERVAL_MINUTES=5

# Mức độ log: debug, info, warn, error
LOG_LEVEL=info
```

### 5.2 Cấu hình Instance AB (sync-ab)

```bash
# Jira URL cho instance AB
JIRA_BASE_URL_AB=https://company-a.atlassian.net

# Email (chỉ cần khi JIRA_AUTH_TYPE=basic)
JIRA_EMAIL_AB=bot-a@company.com

# API Token hoặc PAT
JIRA_API_TOKEN_AB=your-jira-api-token-here

# Project keys
USER_PROJECT_KEY_A=USER-A
DEV_PROJECT_KEY_A=DEV-A

# Database name (mỗi instance có DB riêng)
DATABASE_NAME_A=sync_ab
```

### 5.3 Cấu hình Instance CD (sync-cd)

```bash
# Jira URL cho instance CD
JIRA_BASE_URL_CD=https://company-b.atlassian.net

# Email (chỉ cần khi JIRA_AUTH_TYPE=basic)
JIRA_EMAIL_CD=bot-b@company.com

# API Token hoặc PAT
JIRA_API_TOKEN_CD=your-other-jira-api-token-here

# Project keys
USER_PROJECT_KEY_C=USER-C
DEV_PROJECT_KEY_C=DEV-C

# Database name
DATABASE_NAME_C=sync_cd
```

### 5.4 Cách lấy Jira API Token

1. Đăng nhập vào: https://id.atlassian.com/manage-profile/security/api-tokens
2. Nhấn **Create API token**
3. Đặt tên mô tả (ví dụ: `Jira Sync - Instance AB`)
4. Nhấn **Create**
5. **Copy token ngay** và dán vào `.env.multi`

**Lưu ý:** Bảo mật token, không commit vào git!

---

## 6. Cấu hình Sync Rules

Mỗi instance có file cấu hình sync rules riêng trong thư mục `config/`.

### 6.1 Cấu hình cho Instance AB (sync-ab.json)

```bash
nano config/sync-ab.json
```

Chỉnh sửa các trường quan trọng:

```json
{
  "$schema": "./schemas/sync-rules.schema.json",
  "name": "project-ab-sync",
  "description": "Sync configuration for Project A ↔ Project B",
  "userProjectKey": "USER-A",
  "devProjectKey": "DEV-A",
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
    },
    {
      "id": "dev-closed",
      "sourceStatus": "Closed",
      "targetProject": "user",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "priority": 4,
      "actions": {
        "syncStatus": true,
        "targetStatus": "Resolved",
        "addCrossLink": true,
        "addComment": true,
        "commentTemplate": "Lỗi đã được xử lý tại issue ${sourceKey}"
      }
    }
  ]
}
```

### 6.2 Cấu hình cho Instance CD (sync-cd.json)

```bash
nano config/sync-cd.json
```

Tương tự, chỉnh sửa project keys và rules theo nhu cầu:

```json
{
  "name": "project-cd-sync",
  "description": "Sync configuration for Project C ↔ Project D",
  "userProjectKey": "USER-C",
  "devProjectKey": "DEV-C",
  ...
}
```

### 6.3 Các trường cấu hình quan trọng

| Trường | Mô tả |
|--------|-------|
| `name` | Tên config (đặt theo cặp project) |
| `userProjectKey` | Project key của User project |
| `devProjectKey` | Project key của Dev project |
| `rules[].sourceStatus` | Status trigger sync |
| `rules[].targetProject` | Đích: `"user"` hoặc `"dev"` |
| `rules[].syncDirection` | Hướng sync: `user_to_dev`, `dev_to_user` |
| `rules[].actions.createIssue` | Tạo issue mới |
| `rules[].actions.syncStatus` | Đồng bộ status |
| `rules[].targetStatus` | Status đích (nếu khác sourceStatus) |

---

## 7. Triển khai

### 7.1 Build và Push Image (nếu dùng GHCR)

```bash
# Build image
docker build -t jira-sync:latest .

# Tag với GHCR
docker tag jira-sync:latest ghcr.io/$GHCR_USERNAME/jira-sync:latest

# Push lên GHCR
docker push ghcr.io/$GHCR_USERNAME/jira-sync:latest
```

### 7.2 Khởi động Containers

```bash
# Khởi động tất cả instances
docker-compose -f docker-compose.multi.yml up -d

# Hoặc build lại image trước khi chạy
docker-compose -f docker-compose.multi.yml up -d --build
```

### 7.3 Kiểm tra trạng thái

```bash
# Xem trạng thái tất cả containers
docker-compose -f docker-compose.multi.yml ps

# Kết quả mong đợi:
#   Name                   State           Ports
#  ----------------------------------------------------------------
#  jira-sync-ab           Up              3000/tcp
#  jira-sync-cd           Up              3000/tcp
#  mongo-ab               Up              27017/tcp
#  mongo-cd               Up              27017/tcp
```

### 7.4 Xem logs để xác nhận hoạt động

```bash
# Logs của instance AB
docker logs -f jira-sync-ab

# Logs của instance CD
docker logs -f jira-sync-cd
```

Tìm dòng tương tự để xác nhận sync hoạt động:
```
INFO: Starting sync cycle for project-ab
INFO: Sync completed successfully
```

### 7.5 Xác nhận sync hoạt động đúng

1. **Kiểm tra trạng thái health:**
   ```bash
   docker inspect --format='{{.State.Health.Status}}' jira-sync-ab
   ```
   Kết quả: `healthy`

2. **Kiểm tra logs có error không:**
   ```bash
   docker-compose -f docker-compose.multi.yml logs | grep -i error
   ```

3. **Xác nhận kết nối Jira:**
   ```bash
   docker logs jira-sync-ab 2>&1 | grep -i "connected\|authenticated"
   ```

---

## 8. Giám sát và Bảo trì

### 8.1 Xem logs theo Instance

```bash
# Xem logs real-time của instance AB
docker logs -f jira-sync-ab

# Xem logs 100 dòng cuối của instance CD
docker logs --tail 100 jira-sync-cd

# Xem logs từ 1 giờ trước
docker logs --since 1h jira-sync-ab
```

### 8.2 Kiểm tra Health

```bash
# Kiểm tra health status của tất cả instances
docker inspect --format='{{.Name}}: {{.State.Health.Status}}' \
  $(docker-compose -f docker-compose.multi.yml ps -q)

# Kết quả mong đợi:
# /jira-sync-ab: healthy
# /jira-sync-cd: healthy
```

### 8.3 Kiểm tra tài nguyên

```bash
# Xem resource usage
docker stats

# Xem chi tiết container
docker inspect jira-sync-ab
```

### 8.4 Backup MongoDB

#### Backup thủ công

```bash
# Tạo thư mục backup
mkdir -p backups/$(date +%Y%m%d)

# Backup instance AB
docker exec mongo-ab mongodump \
  --db sync_ab \
  --out /backup/sync_ab_$(date +%Y%m%d)

# Copy về local
docker cp mongo-ab:/backup/sync_ab_$(date +%Y%m%d) ./backups/

# Backup instance CD
docker exec mongo-cd mongodump \
  --db sync_cd \
  --out /backup/sync_cd_$(date +%Y%m%d)

docker cp mongo-cd:/backup/sync_cd_$(date +%Y%m%d) ./backups/
```

#### Backup tự động với cron

```bash
# Mở crontab
crontab -e

# Thêm dòng sau để backup mỗi ngày lúc 2:00 AM
0 2 * * * docker exec mongo-ab mongodump --db sync_ab --out /backup/daily/ && \
  docker exec mongo-cd mongodump --db sync_cd --out /backup/daily/ && \
  docker cp mongo-ab:/backup/daily ./backups/ab_$(date +\%Y\%m\%d) && \
  docker cp mongo-cd:/backup/daily ./backups/cd_$(date +\%Y\%m\%d)
```

### 8.5 Restore từ Backup

```bash
# Restore instance AB
docker exec -i mongo-ab mongorestore \
  --db sync_ab \
  --drop < backups/sync_ab_20240121

# Restore instance CD
docker exec -i mongo-cd mongorestore \
  --db sync_cd \
  --drop < backups/sync_cd_20240121
```

### 8.6 Cập nhật phiên bản mới

```bash
# Bước 1: Pull code mới
git pull origin main

# Bước 2: Rebuild image
docker build -t jira-sync:latest .

# Bước 3: Tag và push lên GHCR (nếu dùng)
docker tag jira-sync:latest ghcr.io/$GHCR_USERNAME/jira-sync:latest
docker push ghcr.io/$GHCR_USERNAME/jira-sync:latest

# Bước 4: Pull image mới trên server
docker pull ghcr.io/$GHCR_USERNAME/jira-sync:latest

# Bước 5: Restart tất cả instances
docker-compose -f docker-compose.multi.yml down
docker-compose -f docker-compose.multi.yml up -d

# Hoặc restart từng instance
docker restart jira-sync-ab jira-sync-cd
```

---

## 9. Thêm Instance mới

Ví dụ: Thêm instance XY để sync USER-X ↔ DEV-X.

### 9.1 Bước 1: Thêm biến vào .env.multi

```bash
nano .env.multi
```

Thêm vào cuối file:

```bash
# Instance XY (USER-X ↔ DEV-X)
JIRA_BASE_URL_XY=https://company-c.atlassian.net
JIRA_EMAIL_XY=bot-c@company.com
JIRA_API_TOKEN_XY=your-third-jira-api-token
USER_PROJECT_KEY_XY=USER-X
DEV_PROJECT_KEY_XY=DEV-X
DATABASE_NAME_XY=sync_xy
```

### 9.2 Bước 2: Thêm service vào docker-compose.multi.yml

```bash
nano docker-compose.multi.yml
```

Thêm vào cuối file:

```yaml
  # ========================================
  # Instance 3: Project X <-> Project Y
  # ========================================
  sync-xy:
    image: ghcr.io/your-username/jira-sync:latest
    container_name: jira-sync-xy
    restart: unless-stopped
    environment:
      INSTANCE_NAME: project-xy
      JIRA_AUTH_TYPE: ${JIRA_AUTH_TYPE:-pat}
      JIRA_BASE_URL: ${JIRA_BASE_URL_XY}
      JIRA_EMAIL: ${JIRA_EMAIL_XY:-}
      JIRA_API_TOKEN: ${JIRA_API_TOKEN_XY}
      USER_PROJECT_KEY: ${USER_PROJECT_KEY_XY:-USER-X}
      DEV_PROJECT_KEY: ${DEV_PROJECT_KEY_XY:-DEV-X}
      SYNC_INTERVAL_MINUTES: ${SYNC_INTERVAL_MINUTES:-5}
      LOG_LEVEL: ${LOG_LEVEL:-info}
      DATABASE_URL: mongodb://mongo-xy:27017
      DATABASE_NAME: ${DATABASE_NAME_XY:-sync_xy}
    depends_on:
      - mongo-xy
    volumes:
      - ./config/sync-xy.json:/app/config/sync-rules.json:ro
    networks:
      default:
        aliases:
          - sync-xy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"

  # MongoDB cho Instance XY
  mongo-xy:
    image: mongo:7
    container_name: mongo-xy
    restart: unless-stopped
    environment:
      MONGO_INITDB_DATABASE: ${DATABASE_NAME_XY:-sync_xy}
    volumes:
      - mongo-xy-data:/data/db
    networks:
      default:
        aliases:
          - mongo-xy
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
```

Thêm volume:

```yaml
volumes:
  mongo-ab-data:
    name: jira-sync-multi-mongo-ab
  mongo-cd-data:
    name: jira-sync-multi-mongo-cd
  mongo-xy-data:
    name: jira-sync-multi-mongo-xy
```

### 9.3 Bước 3: Tạo file cấu hình sync

```bash
cp config/sync-rules.example.json config/sync-xy.json
nano config/sync-xy.json
```

Chỉnh sửa `userProjectKey` và `devProjectKey`:

```json
{
  "name": "project-xy-sync",
  "description": "Sync configuration for Project X ↔ Project Y",
  "userProjectKey": "USER-X",
  "devProjectKey": "DEV-X",
  ...
}
```

### 9.4 Bước 4: Khởi động instance mới

```bash
# Pull image mới (nếu dùng GHCR)
docker pull ghcr.io/your-username/jira-sync:latest

# Khởi động instance mới
docker-compose -f docker-compose.multi.yml up -d sync-xy mongo-xy

# Kiểm tra trạng thái
docker-compose -f docker-compose.multi.yml ps

# Xem logs
docker logs -f jira-sync-xy
```

---

## 10. Xử lý sự cố

### 10.1 Container không khởi động

**Nguyên nhân thường gặp:**
- File `.env.multi` chưa được cấu hình đúng
- Image không tồn tại trên server
- Port đã được sử dụng

**Cách xử lý:**

```bash
# Kiểm tra logs chi tiết
docker logs jira-sync-ab

# Kiểm tra trạng thái container
docker inspect jira-sync-ab

# Kiểm tra ports đang sử dụng
netstat -tlnp | grep 3000
```

### 10.2 Lỗi kết nối Jira

**Kiểm tra:**

```bash
# Xem logs tìm lỗi Jira
docker logs jira-sync-ab 2>&1 | grep -i "jira\|auth\|token"

# Kiểm tra URL và credentials
cat .env.multi | grep JIRA_

# Test kết nối thủ công
curl -u "email:token" "https://your-domain.atlassian.net/rest/api/3/project"
```

**Cách xử lý:**
- Kiểm tra `JIRA_BASE_URL` đúng định dạng (có `https://`)
- Kiểm tra `JIRA_API_TOKEN` còn hiệu lực
- Kiểm tra quyền truy cập project

### 10.3 Lỗi kết nối MongoDB

**Kiểm tra:**

```bash
# Kiểm tra MongoDB container
docker logs mongo-ab

# Test kết nối từ container
docker exec -it jira-sync-ab sh -c "nc -zv mongo-ab 27017"

# Kiểm tra DATABASE_URL trong .env.multi
grep DATABASE .env.multi
```

**Cách xử lý:**
- Đợi MongoDB hoàn toàn khởi động trước khi chạy sync
- Kiểm tra `DATABASE_URL` đúng format: `mongodb://mongo-ab:27017`

### 10.4 Sync không hoạt động

**Kiểm tra:**

```bash
# Kiểm tra scheduler có chạy không
docker logs jira-sync-ab | grep -i "scheduler\|sync.*cycle"

# Kiểm tra health status
docker inspect --format='{{.State.Health.Status}}' jira-sync-ab

# Xem chi tiết sync config
docker exec jira-sync-ab cat /app/config/sync-rules.json
```

**Cách xử lý:**
- Chờ sync interval (mặc định 5 phút)
- Kiểm tra sync rules đã bật (`enabled: true`)
- Kiểm tra project keys đúng trong config

---

## 11. Quick Reference

### 11.1 Các lệnh thường dùng

```bash
# Khởi động tất cả instances
docker-compose -f docker-compose.multi.yml up -d

# Khởi động với rebuild
docker-compose -f docker-compose.multi.yml up -d --build

# Dừng tất cả
docker-compose -f docker-compose.multi.yml down

# Xem trạng thái
docker-compose -f docker-compose.multi.yml ps

# Xem logs tất cả
docker-compose -f docker-compose.multi.yml logs -f

# Xem logs một instance
docker logs -f jira-sync-ab

# Restart một instance
docker restart jira-sync-ab

# Restart tất cả
docker-compose -f docker-compose.multi.yml restart

# Xóa tất cả (bao gồm volumes!)
docker-compose -f docker-compose.multi.yml down -v
```

### 11.2 Kiểm tra và debug

```bash
# Health status của tất cả
docker inspect --format='{{.Name}}: {{.State.Health.Status}}' \
  $(docker-compose -f docker-compose.multi.yml ps -q)

# Resource usage
docker stats

# Vào container để debug
docker exec -it jira-sync-ab sh

# Kiểm tra config trong container
docker exec jira-sync-ab cat /app/config/sync-rules.json
```

### 11.3 Backup và Restore

```bash
# Backup MongoDB instance AB
docker exec mongo-ab mongodump --db sync_ab --out /backup/
docker cp mongo-ab:/backup/ ./backups/ab_$(date +%Y%m%d)

# Restore MongoDB instance AB
docker cp ./backups/ab_20240121/. mongo-ab:/backup/
docker exec mongo-ab mongorestore --db sync_ab --drop /backup/
```

### 11.4 Cập nhật

```bash
# Pull code mới
git pull

# Rebuild và restart
docker-compose -f docker-compose.multi.yml up -d --build

# Hoặc chỉ pull image mới và restart
docker pull ghcr.io/username/jira-sync:latest
docker-compose -f docker-compose.multi.yml restart
```

---

## Liên hệ hỗ trợ

Nếu gặp vấn đề không có trong tài liệu này:
1. Xem logs: `docker logs <container-name>`
2. Kiểm tra health: `docker inspect --format='{{.State.Health}}' <container-name>`
3. Tạo issue trên GitHub repository

---

**Cập nhật lần cuối:** Tháng 1 năm 2026
