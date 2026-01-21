# Spec: Cấu Hình Docker Đa Dự Án

**Change ID:** `multi-project-docker`

**Capability:** `docker-config`

## ADDED Requirements

### Requirement: File Cấu Hình Mẫu

Hệ thống SHALL PROVIDE một file cấu hình mẫu tài liệu hóa tất cả các tùy chọn sync rule có sẵn.

**Rationale:** Giúp operators hiểu và tùy chỉnh behavior sync.

#### Scenario: File Mẫu Tồn tại

**Given** project được checkout
**When** liệt kê thư mục `config/`
**Then** file `sync-rules.example.json` tồn tại
**And** nó chứa cú pháp JSON hợp lệ
**And** nó bao gồm comments giải thích mỗi tùy chọn

#### Scenario: Tất cả Tùy chọn Được Tài liệu hóa

**Given** file cấu hình mẫu
**When** kiểm tra nội dung
**Then** nó tài liệu hóa tất cả rule actions (`createIssue`, `syncStatus`, `syncAttachments`, `addComment`, `addCrossLink`)
**And** nó tài liệu hóa tất cả sync directions (`user_to_dev`, `dev_to_user`, `both`, `none`)

#### Scenario: Sẵn sàng để Copy-Paste

**Given** operator muốn tạo cấu hình tùy chỉnh
**When** copy file mẫu
**Then** file có thể được sử dụng như điểm bắt đầu
**And** chỉ cần thay đổi nhỏ để sử dụng trong production

### Requirement: Docker Compose Đa Instance

Hệ thống SHALL PROVIDE cấu hình Docker Compose để chạy nhiều sync instances độc lập.

**Rationale:** Hỗ trợ deployments multi-project từ một codebase.

#### Scenario: File Multi-Instance Compose Tồn tại

**Given** project được checkout
**When** liệt kê files trong thư mục gốc
**Then** file `docker-compose.multi.yml` tồn tại
**And** nó có thể được parse bởi `docker-compose -f docker-compose.multi.yml config`

#### Scenario: Ví dụ Hai Instance

**Given** file compose multi-instance
**When** kiểm tra nội dung
**Then** nó định nghĩa ít nhất hai service instances (`sync-ab` và `sync-cd`)
**And** mỗi instance có MongoDB container riêng
**And** instances sử dụng các giá trị `DATABASE_NAME` khác nhau

#### Scenario: Instances Được Cách ly

**Given** nhiều instances đang chạy
**When** kiểm tra tên container
**Then** mỗi instance có `container_name` duy nhất
**And** mỗi instance sử dụng database MongoDB riêng
**And** instances không chia sẻ state

### Requirement: Template Environment

Hệ thống SHALL PROVIDE file template environment cho deployment đa instance.

**Rationale:** Tài liệu hóa tất cả variables bắt buộc.

#### Scenario: Template Multi-Instance Env Tồn tại

**Given** project được checkout
**When** liệt kê files
**Then** file `.env.multi.example` tồn tại
**And** nó tài liệu hóa tất cả variables bắt buộc cho mỗi instance

#### Scenario: Biến Instance-Specific

**Given** template environment multi-instance
**When** kiểm tra nội dung
**Then** nó sử dụng đặt tên suffix cho các biến instance-specific (`JIRA_BASE_URL_AB`, `JIRA_API_TOKEN_CD`)
**And** mỗi instance có bộ Jira credentials riêng

### Requirement: Cấu hình Theo Instance

Mỗi instance SHALL ACCEPT cấu hình qua file JSON được mount.

**Rationale:** Cho phép các sync rules khác nhau cho mỗi instance.

#### Scenario: Volume Mount cho Config

**Given** định nghĩa service instance trong `docker-compose.multi.yml`
**When** kiểm tra volume mounts
**Then** một file JSON config được mount đến `/app/config/sync-rules.json`
**And** file được mount read-only (`ro`)

#### Scenario: Instance-Specific Rules

**Given** nhiều instances đang chạy
**When** so sánh các file config được mount
**Then** mỗi instance có thể có các sync rules khác nhau
**And** thay đổi rules trong một file không ảnh hưởng instances khác

### Requirement: Tài liệu trong Compose Chính

File `docker-compose.yml` chính SHALL INCLUDE comments trỏ đến phiên bản multi-instance.

**Rationale:** Giúp operators khám phá tùy chọn multi-instance.

#### Scenario: Tài liệu Có sẵn

**Given** file `docker-compose.yml` chính
**When** đọc file
**Then** comments giải thích cách sử dụng `docker-compose.multi.yml`
**And** comments chỉ ra khi nào sử dụng single vs multi-instance mode

### Requirement: Hướng dẫn Tiếng Việt

Tài liệu SHALL INCLUDE hướng dẫn chi tiết bằng tiếng Việt.

**Rationale:** Hỗ trợ người dùng Việt Nam sử dụng dễ dàng.

#### Scenario: Hướng dẫn Có sẵn

**Given** project được checkout
**When** đọc proposal.md hoặc tài liệu đi kèm
**Then** có hướng dẫn chi tiết bằng tiếng Việt
**And** hướng dẫn bao gồm các bước cấu hình cơ bản
**And** hướng dẫn bao gồm các lệnh quản lý thường dùng

#### Scenario: Các Bước Rõ ràng

**Given** người dùng muốn thiết lập multi-instance
**When** theo dõi hướng dẫn tiếng Việt
**Then** các bước được liệt kê rõ ràng
**And** có ví dụ cụ thể cho từng bước
**And** có mẫu cấu hình hoàn chỉnh

### Requirement: Hướng dẫn Build Image

Tài liệu SHALL INCLUDE hướng dẫn build Docker image chi tiết.

**Rationale:** Người dùng cần biết cách build và deploy image lên server.

#### Scenario: Build Local

**Given** người dùng muốn build image locally
**When** theo dõi hướng dẫn
**Then** có các lệnh docker-compose build và docker build
**And** có hướng dẫn tag image với version
**And** có cách kiểm tra image đã build

#### Scenario: Build cho Production

**Given** người dùng chuẩn bị deploy lên production
**When** theo dõi hướng dẫn build production
**Then** có hướng dẫn build với version cụ thể
**And** có hướng dẫn build cho multi-architecture nếu cần
**And** có hướng dẫn sử dụng build arguments

### Requirement: Hướng dẫn Deploy lên Server

Tài liệu SHALL INCLUDE hướng dẫn deploy chi tiết từ local lên server.

**Rationale:** Người dùng cần biết cách đưa ứng dụng lên server production.

#### Scenario: Chuẩn bị Server

**Given** người dùng có một server mới
**When** theo dõi hướng dẫn chuẩn bị server
**Then** có hướng dẫn cài đặt Docker và Docker Compose
**And** có hướng dẫn cấu hình firewall
**And** có hướng dẫn tạo thư mục cần thiết

#### Scenario: Copy Files lên Server

**Given** người dùng đã chuẩn bị cấu hình
**When** theo dõi hướng dẫn copy files
**Then** có hướng dẫn sử dụng SCP, Rsync, hoặc Git
**And** có hướng dẫn tạo .env.multi từ template
**And** có hướng dẫn tạo config files

#### Scenario: Khởi động trên Server

**Given** files đã được copy lên server
**When** theo dõi hướng dẫn khởi động
**Then** có hướng dẫn pull hoặc build images
**And** có hướng dẫn chạy docker-compose
**And** có cách kiểm tra trạng thái và logs

### Requirement: Hướng dẫn Docker Registry

Tài liệu SHALL INCLUDE hướng dẫn sử dụng Docker Registry.

**Rationale:** Hỗ trợ team workflows với private hoặc public registry.

#### Scenario: Push lên Registry

**Given** người dùng muốn lưu image lên registry
**When** theo dõi hướng dẫn push
**Then** có hướng dẫn đăng nhập Docker registry
**And** có hướng dẫn tag và push image
**And** có hướng dẫn pull từ registry trên server

#### Scenario: Sử dụng Docker Hub

**Given** người dùng muốn share image công khai
**When** theo dõi hướng dẫn Docker Hub
**Then** có hướng dẫn tag cho Docker Hub
**And** có hướng dẫn push lên Docker Hub
**And** có cách pull từ Docker Hub

### Requirement: Cấu hình Production

Tài liệu SHALL INCLUDE các cấu hình production best practices.

**Rationale:** Đảm bảo ứng dụng chạy ổn định trên production.

#### Scenario: Docker Secrets

**Given** người dùng muốn bảo mật credentials
**When** theo dõi hướng dẫn Docker secrets
**Then** có ví dụ cấu hình Docker secrets
**And** có cách tạo và sử dụng secrets
**And** có lưu ý về bảo mật

#### Scenario: Resource Limits

**Given** người dùng muốn giới hạn tài nguyên
**When** theo dõi hướng dẫn resource limits
**Then** có ví dụ cấu hình CPU và memory limits
**And** có cách cấu hình restart policy
**And** có cách cấu hình healthcheck

#### Scenario: SSL và HTTPS

**Given** người dùng muốn bảo mật kết nối
**When** theo dõi hướng dẫn SSL
**Then** có ví dụ cấu hình Nginx reverse proxy
**And** có hướng dẫn cài đặt SSL với Let's Encrypt
**And** có cách cấu hình auto-renewal cho SSL

### Requirement: Backup và Restore

Tài liệu SHALL INCLUDE hướng dẫn backup và restore dữ liệu.

**Rationale:** Đảm bảo dữ liệu không bị mất.

#### Scenario: Backup MongoDB

**Given** người dùng muốn backup dữ liệu
**When** theo dõi hướng dẫn backup
**Then** có cách backup từng MongoDB instance
**And** có cách copy backup về local
**And** có script tự động backup với crontab

#### Scenario: Restore từ Backup

**Given** người dùng cần khôi phục dữ liệu
**When** theo dõi hướng dẫn restore
**Then** có cách restore từ backup file
**And** có các bước kiểm tra sau khi restore

### Requirement: Monitoring và Update

Tài liệu SHALL INCLUDE hướng dẫn monitoring và update.

**Rationale:** Đảm bảo ứng dụng luôn healthy và được cập nhật.

#### Scenario: Kiểm tra Health

**Given** người dùng muốn monitor instances
**When** theo dõi hướng dẫn monitoring
**Then** có các lệnh kiểm tra trạng thái containers
**And** có cách xem logs
**And** có cách kiểm tra resource usage

#### Scenario: Update phiên bản mới

**Given** có phiên bản mới cần deploy
**When** theo dõi hướng dẫn update
**Then** có các bước backup trước khi update
**And** có cách pull/build phiên bản mới
**And** có cách restart mà không gây downtime

### Requirement: Checklist Deploy Production

Tài liệu SHALL INCLUDE checklist đầy đủ cho production deployment.

**Rationale:** Đảm bảo không bỏ sót bước nào quan trọng.

#### Scenario: Checklist có sẵn

**Given** người dùng chuẩn bị deploy lên production
**When** đọc checklist
**Then** có danh sách các bước cần kiểm tra
**And** có nơi ghi chú thông tin quan trọng
**And** có các mục cho server, domain, API tokens, backup

## Cross-Reference

- **Spec liên quan:** `sync-flow-config` (định dạng cấu hình)
- **Spec liên quan:** `embedded-config` (cấu hình mặc định)
- **Files liên quan:**
  - `config/sync-rules.example.json`: Ví dụ cấu hình
  - `docker-compose.multi.yml`: Deployment multi-instance
  - `.env.multi.example`: Template environment
