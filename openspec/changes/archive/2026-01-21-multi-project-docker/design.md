# Design: Cấu Hình Docker Đa Dự Án

**Change ID:** `multi-project-docker`

## Tổng quan kiến trúc

Thiết kế này thêm ví dụ cấu hình và hỗ trợ Docker Compose đa instance để triển khai nhiều cặp project Jira sync từ một codebase duy nhất.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Triển khai Đa Instance                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐ │
│  │   Instance 1    │     │   Instance 2    │     │   Instance N    │ │
│  │   (sync-ab)     │     │   (sync-cd)     │     │   (sync-xy)     │ │
│  │                 │     │                 │     │                 │ │
│  │  USER-A ↔ DEV-B │     │  USER-C ↔ DEV-D │     │  USER-X ↔ DEV-Y │ │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘ │
│           │                       │                       │          │
│           ▼                       ▼                       ▼          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Docker Network (jira-sync-multi)               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Các thành phần chính

### 1. File cấu hình mẫu

**Vị trí:** `config/sync-rules.example.json`

```json
{
  "$schema": "./schemas/sync-rules.schema.json",
  "name": "example-sync-config",
  "description": "Ví dụ cấu hình cho Jira project sync",
  "userProjectKey": "USER",
  "devProjectKey": "DEV",
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
      "description": "Tạo Dev issue khi User issue ở trạng thái 'Will Do'",
      "conditions": {
        "requireMapping": false
      },
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

### 2. Docker Compose đa Instance

**Vị trí:** `docker-compose.multi.yml`

```yaml
version: "3.9"

services:
  # Instance 1: Project A <-> Project B
  sync-ab:
    image: jira-sync:latest
    container_name: jira-sync-ab
    restart: unless-stopped
    environment:
      INSTANCE_NAME: project-ab
      JIRA_AUTH_TYPE: ${JIRA_AUTH_TYPE:-pat}
      JIRA_BASE_URL: ${JIRA_BASE_URL_AB}
      JIRA_EMAIL: ${JIRA_EMAIL_AB:-}
      JIRA_API_TOKEN: ${JIRA_API_TOKEN_AB}
      USER_PROJECT_KEY: USER-A
      DEV_PROJECT_KEY: DEV-B
      SYNC_INTERVAL_MINUTES: ${SYNC_INTERVAL_MINUTES:-5}
      DATABASE_URL: mongodb://mongo-ab:27017
      DATABASE_NAME: sync_ab
      LOG_LEVEL: ${LOG_LEVEL:-info}
    depends_on:
      - mongo-ab
    volumes:
      - ./config/sync-ab.json:/app/config/sync-rules.json:ro
    networks:
      default:
        aliases:
          - sync-ab

  mongo-ab:
    image: mongo:7
    container_name: mongo-ab
    restart: unless-stopped
    volumes:
      - mongo-ab-data:/data/db
    networks:
      default:
        aliases:
          - mongo-ab

  # Instance 2: Project C <-> Project D
  sync-cd:
    image: jira-sync:latest
    container_name: jira-sync-cd
    restart: unless-stopped
    environment:
      INSTANCE_NAME: project-cd
      JIRA_AUTH_TYPE: ${JIRA_AUTH_TYPE:-pat}
      JIRA_BASE_URL: ${JIRA_BASE_URL_CD}
      JIRA_EMAIL: ${JIRA_EMAIL_CD:-}
      JIRA_API_TOKEN: ${JIRA_API_TOKEN_CD}
      USER_PROJECT_KEY: USER-C
      DEV_PROJECT_KEY: DEV-D
      SYNC_INTERVAL_MINUTES: ${SYNC_INTERVAL_MINUTES:-5}
      DATABASE_URL: mongodb://mongo-cd:27017
      DATABASE_NAME: sync_cd
      LOG_LEVEL: ${LOG_LEVEL:-info}
    depends_on:
      - mongo-cd
    volumes:
      - ./config/sync-cd.json:/app/config/sync-rules.json:ro
    networks:
      default:
        aliases:
          - sync-cd

  mongo-cd:
    image: mongo:7
    container_name: mongo-cd
    restart: unless-stopped
    volumes:
      - mongo-cd-data:/data/db
    networks:
      default:
        aliases:
          - mongo-cd

networks:
  default:
    name: jira-sync-multi
    driver: bridge

volumes:
  mongo-ab-data:
  mongo-cd-data:
```

### 3. File Template Environment

**Vị trí:** `.env.multi.example`

```bash
# Cấu hình chung
JIRA_AUTH_TYPE=pat
SYNC_INTERVAL_MINUTES=5
LOG_LEVEL=info

# Instance 1: Project A <-> B
JIRA_BASE_URL_AB=https://company-a.atlassian.net
JIRA_EMAIL_AB=bot-a@company.com
JIRA_API_TOKEN_AB=your-api-token-ab

# Instance 2: Project C <-> D
JIRA_BASE_URL_CD=https://company-b.atlassian.net
JIRA_EMAIL_CD=bot-b@company.com
JIRA_API_TOKEN_CD=your-api-token-cd
```

## Các quyết định thiết kế

### Quyết định 1: MongoDB riêng biệt cho mỗi Instance

**Lựa chọn:** Mỗi instance có MongoDB container riêng

**Lý do:**
- Cách ly hoàn toàn giữa các instances
- Dễ dàng backup/restore cho từng cặp project
- Không có xung đột state
- Đơn giản hóa troubleshooting

**Thay thế đã xem xét:** Chia sẻ MongoDB với các collection khác nhau
- Rủi ro va chạm state
- Khó migrate/remove instances
- Queries phức tạp hơn

### Quyết định 2: Cấu hình dựa trên File

**Lựa chọn:** Config file được mount qua volume

**Lý do:**
- Dễ dàng update không cần rebuild image
- Có thể version control
- Config khác nhau cho từng instance
- Phân tách rõ ràng cho operators

**Thay thế đã xem xét:** Chỉ environment variables
- Ít linh hoạt hơn cho các rules phức tạp
- Khó tài liệu hóa các tùy chọn
- Không có file tham chiếu cho operators

### Quyết định 3: Docker Network Aliases

**Lựa chọn:** Sử dụng network aliases cho service discovery

**Lý do:**
- Dễ dàng nhận diện logs bằng container name
- Đặt tên nhất quán qua các instances
- Phân tách rõ ràng trong công cụ monitoring

## Các mẫu triển khai

### Mẫu 1: Đơn Instance (Mặc định)

```bash
docker-compose up -d
```

### Mẫu 2: Đa Instance

```bash
docker-compose -f docker-compose.multi.yml up -d
```

### Mẫu 3: Thêm Instance Mới

1. Copy block instance hiện có
2. Cập nhật `INSTANCE_NAME`, `container_name`, volumes
3. Thêm biến môi trường vào `.env.multi`
4. Tạo file config mới trong `config/`
5. Chạy `docker-compose -f docker-compose.multi.yml up -d`

## Các lệnh quản lý

```bash
# Khởi động tất cả instances
docker-compose -f docker-compose.multi.yml up -d

# Xem logs của instance cụ thể
docker logs jira-sync-ab
docker logs jira-sync-cd

# Dừng tất cả instances
docker-compose -f docker-compose.multi.yml down

# Kiểm tra trạng thái
docker-compose -f docker-compose.multi.yml ps

# Restart instance cụ thể
docker-compose -f docker-compose.multi.yml restart sync-ab

# Xem logs theo thời gian thực
docker logs -f jira-sync-ab
```

## Mở rộng tương lai

- **Kubernetes Templates**: Thêm manifests deployment K8s
- **Config Maps**: Sử dụng K8s ConfigMaps cho cấu hình
- **Prometheus Metrics**: Thêm endpoint metrics cho mỗi instance
- **Centralized Logging**: Tích hợp với ELK stack
