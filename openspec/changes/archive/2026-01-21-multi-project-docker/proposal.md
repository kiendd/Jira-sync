# Proposal: Cấu Hình Docker Đa Dự Án

**Change ID:** `multi-project-docker`

**Trạng thái:** Bản nháp

**Ngày tạo:** 2026-01-21

**Yêu cầu người dùng:** "tạo file config rule mẫu (example), viết docker compose mẫu cho phép cấu hình nhiều dự án trong 1 source code build"

## Tóm tắt

Tạo các file cấu hình mẫu và thiết lập Docker Compose để hỗ trợ chạy nhiều cặp project Jira sync từ một codebase duy nhất. Hiện tại, service được cấu hình qua environment variables và config nhúng, không hỗ trợ nhiều cấu hình sync độc lập một cách dễ dàng.

Đề xuất này thêm:
1. **File config mẫu**: `config/sync-rules.example.json` - Tài liệu hóa các tùy chọn cấu hình có sẵn
2. **Docker compose đa instance**: `docker-compose.multi.yml` - Chạy nhiều service instance cho các cặp project khác nhau

## Tại sao

**Hạn chế hiện tại:**
- Một cấu hình mỗi deployment
- Không có cách dễ dàng để sync nhiều cặp project (ví dụ: PROJECT-A ↔ PROJECT-B và PROJECT-C ↔ PROJECT-D)
- Không có tài liệu về các tùy chọn cấu hình
- Chỉ environment variables - không có cấu hình file

**Lợi ích của thay đổi này:**
- Chạy nhiều cấu hình sync từ cùng một codebase
- Tài liệu rõ ràng về các tùy chọn cấu hình
- Instance độc lập cho mỗi cặp project (logs riêng, databases riêng)
- Dễ dàng thêm/xóa cặp project không cần thay đổi code
- Sẵn sàng cho production cho các kịch bản multi-tenant hoặc multi-project

## Thay đổi gì

### File mới

1. **`config/sync-rules.example.json`** - Ví dụ cấu hình sync rules
   - Tài liệu hóa tất cả các tùy chọn rule có sẵn
   - Hiển thị các kịch bản sync khác nhau
   - Có thể copy và tùy chỉnh cho sử dụng thực tế

2. **`docker-compose.multi.yml`** - Deployment đa instance
   - Template để chạy nhiều service instance
   - Mỗi instance có MongoDB riêng biệt
   - Cấu hình dựa trên environment variables cho từng instance
   - Services được đặt tên để dễ dàng nhận diện

### File sửa đổi

1. **`docker-compose.yml`** - Thêm comment trỏ đến phiên bản multi-instance
2. **`.env.example`** - Thêm tài liệu cho thiết lập multi-instance

## Kiến trúc

### Đơn Instance (Hiện tại)
```
┌─────────────────────────────────────┐
│         Jira Sync Service           │
│                                     │
│  USER-PROJECT ↔ DEV-PROJECT         │
│  (Cố định tại thời điểm build)      │
└─────────────────────────────────────┘
```

### Đa Instance (Đề xuất này)
```
┌─────────────────────────────────────────────────────────┐
│                   Docker Network                         │
├──────────────┬──────────────┬──────────────────────────┤
│  Instance 1  │  Instance 2  │  Instance N              │
│              │              │                          │
│  USER-A ↔    │  USER-C ↔    │  USER-X ↔ DEV-Y          │
│  DEV-B       │  DEV-D       │                          │
│              │              │                          │
│  MongoDB     │  MongoDB     │  MongoDB                 │
└──────────────┴──────────────┴──────────────────────────┘
```

## Hướng dẫn cấu hình (Tiếng Việt)

### Bước 1: Chuẩn bị file cấu hình

Tạo file config cho mỗi instance trong thư mục `config/`:

```bash
# Tạo thư mục config nếu chưa có
mkdir -p config

# Copy file mẫu
cp config/sync-rules.example.json config/sync-ab.json
cp config/sync-rules.example.json config/sync-cd.json
```

### Bước 2: Cấu hình file sync-ab.json

```json
{
  "name": "project-ab-sync",
  "description": "Cấu hình sync cho PROJECT-A và PROJECT-B",
  "userProjectKey": "USER-A",
  "devProjectKey": "DEV-B",
  "defaultBehavior": {
    "syncAttachments": true,
    "addCrossLinks": true,
    "onlyOnStatusChange": true,
    "skipIntermediateStatuses": true
  },
  "rules": [
    {
      "sourceStatus": "Will Do",
      "targetProject": "dev",
      "syncDirection": "user_to_dev",
      "enabled": true,
      "actions": {
        "createIssue": true,
        "syncAttachments": true,
        "addCrossLink": true,
        "addComment": true,
        "commentTemplate": "Đã tạo Dev Issue: ${targetKey}"
      }
    },
    {
      "sourceStatus": "Closed",
      "targetProject": "user",
      "targetStatus": "Resolved",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "actions": {
        "syncStatus": true,
        "addComment": true,
        "commentTemplate": "Lỗi đã được xử lý tại issue ${sourceKey}"
      }
    }
  ]
}
```

### Bước 3: Cấu hình file .env.multi

Tạo file `.env.multi` với các biến môi trường:

```bash
# Cấu hình chung
JIRA_AUTH_TYPE=pat
SYNC_INTERVAL_MINUTES=5
LOG_LEVEL=info

# Instance 1: Project A <-> B
JIRA_BASE_URL_AB=https://company.atlassian.net
JIRA_API_TOKEN_AB=your-api-token-here
USER_PROJECT_KEY_A=USER-A
DEV_PROJECT_KEY_A=DEV-B
DATABASE_NAME_A=sync_ab

# Instance 2: Project C <-> D  
JIRA_BASE_URL_CD=https://other-company.atlassian.net
JIRA_API_TOKEN_CD=your-other-api-token-here
USER_PROJECT_KEY_C=USER-C
DEV_PROJECT_KEY_C=DEV-D
DATABASE_NAME_C=sync_cd
```

### Bước 4: Khởi động Docker Compose

```bash
# Build image
docker-compose build

# Chạy multi-instance
docker-compose -f docker-compose.multi.yml up -d

# Kiểm tra trạng thái
docker-compose -f docker-compose.multi.yml ps

# Xem logs của instance cụ thể
docker logs jira-sync-ab
docker logs jira-sync-cd
```

### Bước 5: Thêm instance mới

Để thêm instance mới (ví dụ: sync-xy):

1. Thêm service vào `docker-compose.multi.yml`:

```yaml
sync-xy:
  image: jira-sync:latest
  container_name: jira-sync-xy
  environment:
    INSTANCE_NAME: project-xy
    JIRA_BASE_URL: ${JIRA_BASE_URL_XY}
    JIRA_API_TOKEN: ${JIRA_API_TOKEN_XY}
    USER_PROJECT_KEY: USER-X
    DEV_PROJECT_KEY: DEV-Y
    DATABASE_URL: mongodb://mongo-xy:27017
    DATABASE_NAME: sync_xy
  volumes:
    - ./config/sync-xy.json:/app/config/sync-rules.json:ro

mongo-xy:
  image: mongo:7
  container_name: mongo-xy
  volumes:
    - mongo-xy-data:/data/db
```

2. Thêm biến vào `.env.multi`:

```bash
JIRA_BASE_URL_XY=https://new-company.atlassian.net
JIRA_API_TOKEN_XY=new-api-token
USER_PROJECT_KEY_XY=USER-X
DEV_PROJECT_KEY_XY=DEV-Y
DATABASE_NAME_XY=sync_xy
```

3. Tạo file config:

```bash
cp config/sync-rules.example.json config/sync-xy.json
# Chỉnh sửa config/sync-xy.json theo nhu cầu
```

4. Khởi động:

```bash
docker-compose -f docker-compose.multi.yml up -d
```

## Các lệnh quản lý

| Lệnh | Mô tả |
|------|-------|
| `docker-compose -f docker-compose.multi.yml up -d` | Khởi động tất cả instances |
| `docker-compose -f docker-compose.multi.yml down` | Dừng tất cả instances |
| `docker logs jira-sync-ab` | Xem logs của instance ab |
| `docker-compose -f docker-compose.multi.yml ps` | Liệt kê trạng thái các container |
| `docker-compose -f docker-compose.multi.yml restart jira-sync-ab` | Restart instance cụ thể |

## Cấu trúc thư mục sau triển khai

```
├── config/
│   ├── sync-rules.example.json  <- File mẫu
│   ├── sync-ab.json             <- Config cho instance AB
│   └── sync-cd.json             <- Config cho instance CD
├── docker-compose.yml           <- Single instance
├── docker-compose.multi.yml     <- Multi-instance
├── .env.example                 <- Env mẫu single
├── .env.multi.example           <- Env mẫu multi
└── .env.multi                   <- Env thực tế (không commit)
```

## Xử lý sự cố

### Không thể kết nối Jira

```bash
# Kiểm tra API token
docker exec jira-sync-ab env | grep JIRA

# Test kết nối
docker exec jira-sync-ab curl -s ${JIRA_BASE_URL_AB}/rest/api/2/myself
```

### Không thể kết nối MongoDB

```bash
# Kiểm tra MongoDB container
docker logs mongo-ab

# Test kết nối từ app container
docker exec jira-sync-ab nc -zv mongo-ab 27017
```

### Logs không hiển thị

```bash
# Kiểm tra LOG_LEVEL
docker exec jira-sync-ab env | grep LOG_LEVEL

# Tăng log level
docker-compose -f docker-compose.multi.yml exec jira-sync-ab bash
# Trong container: export LOG_LEVEL=debug
```

## Timeline

- **Phase 1**: Tạo file config mẫu (0.25 ngày)
- **Phase 2**: Tạo docker-compose multi-instance (0.5 ngày)
- **Phase 3**: Cập nhật tài liệu (0.25 ngày)

**Tổng ước tính:** 1 ngày

## Hướng dẫn Build Image

### Build Local (Development)

```bash
# Clone repository
git clone <your-repo-url>
cd jira-sync

# Build image
docker-compose build

# Hoặc build với tag tùy chỉnh
docker build -t jira-sync:latest .

# Kiểm tra image đã build
docker images | grep jira-sync
```

### Build cho Production

```bash
# Build với tag version cụ thể
docker build -t jira-sync:v1.0.0 .

# Build cho multi-architecture (nếu cần)
docker buildx build --platform linux/amd64,linux/arm64 -t jira-sync:v1.0.0 --push .
```

### Build với Build Arguments

```bash
# Build với custom settings
docker build \
  --build-arg NODE_VERSION=20 \
  --build-arg NPM_TOKEN=your-token \
  -t jira-sync:production .
```

## Hướng dẫn Deploy lên Server

### Bước 1: Chuẩn bị Server

```bash
# Đăng nhập vào server
ssh user@your-server-ip

# Cài đặt Docker (nếu chưa có)
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

# Thêm user vào docker group
sudo usermod -aG docker $USER
# Logout và login lại để áp dụng
```

### Bước 2: Tạo thư mục trên Server

```bash
# Tạo thư mục cho ứng dụng
mkdir -p /opt/jira-sync
cd /opt/jira-sync

# Tạo cấu trúc thư mục
mkdir -p config logs
```

### Bước 3: Copy files lên Server

```bash
# Cách 1: Sử dụng SCP (từ máy local)
scp -r config docker-compose.multi.yml .env.multi.example user@your-server-ip:/opt/jira-sync/

# Cách 2: Sử dụng Git
cd /opt/jira-sync
git clone <your-repo-url> .
git checkout <branch-name>

# Cách 3: Sử dụng rsync (khuyến nghị cho file lớn)
rsync -avz --progress \
  -e ssh \
  ./config/ ./docker-compose.multi.yml .env.multi.example \
  user@your-server-ip:/opt/jira-sync/
```

### Bước 4: Cấu hình trên Server

```bash
# Đăng nhập server
ssh user@your-server-ip
cd /opt/jira-sync

# Tạo file .env.multi từ template
cp .env.multi.example .env.multi

# Chỉnh sửa file .env.multi
nano .env.multi

# Cấu hình các biến:
# JIRA_BASE_URL_AB=https://company.atlassian.net
# JIRA_API_TOKEN_AB=your-api-token
# USER_PROJECT_KEY_A=USER-A
# DEV_PROJECT_KEY_A=DEV-B
# DATABASE_NAME_A=sync_ab
```

### Bước 5: Tạo Config Files

```bash
# Copy file config mẫu
cp config/sync-rules.example.json config/sync-ab.json
cp config/sync-rules.example.json config/sync-cd.json

# Chỉnh sửa config theo nhu cầu
nano config/sync-ab.json
nano config/sync-cd.json
```

### Bước 6: Pull và Chạy Docker Containers

```bash
# Đăng nhập Docker Registry (nếu có private registry)
# docker login registry.example.com

# Pull image từ registry (nếu đã push lên registry)
# docker pull jira-sync:v1.0.0

# Hoặc build trực tiếp trên server
docker-compose -f docker-compose.multi.yml build

# Khởi động containers
docker-compose -f docker-compose.multi.yml up -d

# Kiểm tra trạng thái
docker-compose -f docker-compose.multi.yml ps

# Xem logs
docker logs jira-sync-ab
docker logs jira-sync-cd
```

## Triển khai với Docker Registry

### Push lên Private Registry

```bash
# Đăng nhập registry
docker login registry.example.com

# Tag image
docker tag jira-sync:latest registry.example.com/jira-sync:v1.0.0

# Push lên registry
docker push registry.example.com/jira-sync:v1.0.0

# Trên server: Pull từ registry
docker pull registry.example.com/jira-sync:v1.0.0
```

### Sử dụng Docker Hub

```bash
# Tag cho Docker Hub
docker tag jira-sync:latest yourusername/jira-sync:v1.0.0

# Push lên Docker Hub
docker push yourusername/jira-sync:v1.0.0

# Trên server: Pull từ Docker Hub
docker pull yourusername/jira-sync:v1.0.0
```

## Cấu hình Production

### 1. Sử dụng Docker Secrets

Tạo file secrets:

```bash
# Tạo file secrets
echo "your-api-token" | docker secret create jira_api_token_ab -
echo "your-database-password" | docker secret create mongo_password -
```

Cập nhật docker-compose:

```yaml
secrets:
  jira_api_token_ab:
    file: ./secrets/jira_api_token_ab.txt
  mongo_password:
    file: ./secrets/mongo_password.txt

services:
  sync-ab:
    secrets:
      - jira_api_token_ab
    environment:
      - JIRA_API_TOKEN_FILE=/run/secrets/jira_api_token_ab
```

### 2. Cấu hình Restart Policy

```yaml
services:
  sync-ab:
    restart: always  # Tự động restart khi crash
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 3. Giới hạn Resources

```yaml
services:
  sync-ab:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 4. Cấu hình Logging

```yaml
services:
  sync-ab:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"
```

## Cấu hình Nginx Reverse Proxy (Production)

### Cấu hình Nginx

```nginx
# /etc/nginx/sites-available/jira-sync

server {
    listen 80;
    server_name jira-sync.your-domain.com;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name jira-sync.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/jira-sync.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jira-sync.your-domain.com/privkey.pem;

    # Health check endpoint (nếu có)
    location /health {
        return 200 "OK";
        add_header Content-Type text/plain;
    }

    # Logs
    access_log /var/log/nginx/jira-sync-access.log;
    error_log /var/log/nginx/jira-sync-error.log;
}
```

### Enable và khởi động Nginx

```bash
sudo ln -s /etc/nginx/sites-available/jira-sync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Setup SSL với Let's Encrypt

```bash
# Cài đặt Certbot
sudo apt install -y certbot python3-certbot-nginx

# Lấy certificate
sudo certbot --nginx -d jira-sync.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## Backup và Restore

### Backup MongoDB

```bash
# Backup một database
docker exec mongo-ab mongodump --db sync_ab --out /backup/sync_ab_$(date +%Y%m%d)

# Copy backup về local
docker cp mongo-ab:/backup/sync_ab_$(date +%Y%m%d) ./backups/

# Backup tất cả databases
docker exec mongo-ab mongodump --out /backup/all_$(date +%Y%m%d)
```

### Restore MongoDB

```bash
# Restore từ backup
docker cp ./backups/sync_ab_20260121 mongo-ab:/restore
docker exec mongo-ab mongorestore --db sync_ab /restore/sync_ab
```

### Script tự động backup

Tạo file `backup.sh`:

```bash
#!/bin/bash
# /opt/jira-sync/backup.sh

BACKUP_DIR="/opt/jira-sync/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup each MongoDB instance
for db_container in mongo-ab mongo-cd; do
    db_name=$(echo $db_container | sed 's/mongo-//')
    docker exec $db_container mongodump --db sync_$db_name --out /backup/${db_name}_$DATE
    docker cp $db_container:/backup/${db_name}_$DATE $BACKUP_DIR/
done

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;

echo "Backup completed: $DATE"
```

Crontab cho backup hàng ngày:

```bash
# Chạy crontab -e
0 2 * * * /opt/jira-sync/backup.sh >> /var/log/backup.log 2>&1
```

## Monitoring

### Kiểm tra Health

```bash
# Kiểm tra tất cả containers
docker-compose -f docker-compose.multi.yml ps

# Kiểm tra logs với timestamp
docker logs --tail 100 -f jira-sync-ab

# Kiểm tra resource usage
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
  $(docker-compose -f docker-compose.multi.yml ps -q)
```

### Thiết lập Prometheus Metrics (Optional)

```yaml
services:
  sync-ab:
    environment:
      - METRICS_ENABLED=true
      - METRICS_PORT=9090
    ports:
      - "9090:9090"
```

## Update phiên bản mới

```bash
# Backup trước khi update
/opt/jira-sync/backup.sh

# Pull phiên bản mới
docker-compose -f docker-compose.multi.yml pull

# Hoặc rebuild nếu có thay đổi code
docker-compose -f docker-compose.multi.yml build

# Restart với phiên bản mới
docker-compose -f docker-compose.multi.yml up -d

# Kiểm tra sau update
docker-compose -f docker-compose.multi.yml ps
docker logs jira-sync-ab --tail 50
```

## Checklist Deploy Production

- [ ] Server đã cài Docker và Docker Compose
- [ ] Đã cấu hình firewall (mở port cần thiết)
- [ ] Đã tạo và cấu hình .env.multi
- [ ] Đã tạo config files cho từng instance
- [ ] Đã test locally trước khi deploy
- [ ] Đã cấu hình SSL/HTTPS
- [ ] Đã cấu hình backup
- [ ] Đã cấu hình monitoring
- [ ] Đã kiểm tra logs sau khi deploy
- [ ] Đã note lại các thông tin quan trọng:
  - Server IP: _______________
  - Domain: _______________
  - API Tokens: _______________
  - Backup location: _______________

