# Proposal: Configure Sync Flow Between Two Projects

**Change ID:** `configure-sync-flow`

**Status:** Approved

**Created:** 2026-01-21

**Approved:** 2026-01-21

**User Request:** "tôi muốn có thể cấu hình sync flow giữa 2 dự án, hãy nghiên cứu và đề xuất cách làm"

## Summary

Enable configuration of the bidirectional sync flow between User and Dev Jira projects. Currently, sync rules are hardcoded in sync modules with fixed status triggers and behaviors. This proposal introduces a flexible configuration system allowing operators to customize:
- Which project statuses trigger sync operations
- Direction of sync (unidirectional/bidirectional per status)
- Field synchronization rules
- Enable/disable specific sync behaviors

## Why

The current sync behavior is hardcoded, requiring code changes to modify:
- Which statuses trigger issue creation
- Which statuses are mirrored between projects
- What actions are performed on sync

This limits operational flexibility and increases the cost of adapting to different team workflows. A configurable sync flow would allow operators to:
- Adjust sync rules without deployments
- Support different project configurations
- Enable/disable specific sync behaviors for testing or debugging

## What Changes

This change introduces configurable sync rules stored in MongoDB:

1. **New Data Model**: `SyncFlowConfig` collection with configurable rules
2. **New Repository**: `SyncConfigRepository` for CRUD operations
3. **New Service**: `ConfigLoader` with validation and fallback to defaults
4. **Modified Sync Modules**: `sync-user-to-dev.ts` and `sync-dev-to-user.ts` accept config parameter
5. **Modified Scheduler**: Passes config to sync functions each cycle

### Files Changed

- `src/db/models.ts`: Add SyncFlowConfig schema
- `src/db/sync-config-repo.ts`: New file - config repository
- `src/sync/config-loader.ts`: New file - config loading service
- `src/sync/sync-user-to-dev.ts`: Refactor to use config
- `src/sync/sync-dev-to-user.ts`: Refactor to use config
- `src/scheduler.ts`: Pass config to sync functions

### Backward Compatibility

- Default configuration embedded in ConfigLoader matches current behavior
- Existing deployments continue working without changes
- Invalid configs fall back to default

## Configuration Format Options

The proposal uses MongoDB JSON documents, but here are alternative formats to consider:

### Option A: MongoDB Document (Current Proposal)

**Pros:**
- Runtime updates without deployment
- Centralized management
- Existing MongoDB infrastructure
- Versioning possible via documents

**Cons:**
- No schema validation at write time
- Hard to review changes (no diff)
- Limited tooling for editing

```json
{
  "name": "default",
  "rules": [
    {
      "sourceStatus": "Will Do",
      "targetProject": "dev",
      "targetStatus": "Bug",
      "syncDirection": "user_to_dev",
      "enabled": true,
      "actions": {
        "createIssue": true,
        "syncAttachments": true
      }
    },
    {
      "sourceStatus": "Reopened",
      "targetProject": "user",
      "syncDirection": "both",
      "enabled": true,
      "actions": {
        "syncStatus": true
      }
    },
    {
      "sourceStatus": "In Progress",
      "targetProject": "user",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "actions": {
        "syncStatus": true
      }
    },
    {
      "sourceStatus": "Closed",
      "targetProject": "user",
      "targetStatus": "Resolved",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "actions": {
        "syncStatus": true
      }
    },
    {
      "sourceStatus": "Cancelled",
      "targetProject": "user",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "actions": {
        "syncStatus": true
      }
    }
  ]
}
```

### Option B: YAML File in Repository

**Pros:**
- Human-readable, supports comments
- Version control friendly (git diff)
- Easy to review changes
- Familiar to DevOps teams

**Cons:**
- Requires deployment to update
- No runtime validation
- Separate from database

```yaml
name: default
rules:
  - sourceStatus: Will Do
    targetProject: dev
    targetStatus: Bug  # Issue type, not status
    syncDirection: user_to_dev
    actions:
      createIssue: true
      syncAttachments: true
  - sourceStatus: Reopened
    targetProject: user
    syncDirection: both
    actions:
      syncStatus: true
  - sourceStatus: Closed
    targetProject: user
    targetStatus: Resolved  # Dev "Closed" → User "Resolved"
    syncDirection: dev_to_user
    actions:
      syncStatus: true
```

### Option C: TypeScript/JavaScript Module

**Pros:**
- Type-safe with TypeScript
- Can include transforms/functions
- IDE autocomplete support
- Conditional logic possible

**Cons:**
- Requires build step for changes
- Security risk (eval/execution)
- Harder for non-developers

```typescript
export default {
  name: 'default',
  rules: [
    { 
      sourceStatus: 'Will Do', 
      targetProject: 'dev',
      targetStatus: 'Bug',
      syncDirection: 'user_to_dev',
      actions: { createIssue: true, syncAttachments: true }
    },
    { 
      sourceStatus: 'Closed',
      targetProject: 'user',
      targetStatus: 'Resolved',  // Dev "Closed" → User "Resolved"
      syncDirection: 'dev_to_user',
      actions: { syncStatus: true }
    }
  ]
} as SyncFlowConfig;
```

### Option D: Environment Variables

**Pros:**
- No file/database needed
- Works with container orchestration
- Easy for simple configs

**Cons:**
- Poor for complex/hierarchical data
- No structure validation
- Hard to maintain

```bash
SYNC_RULE_1_SOURCE=Will Do
SYNC_RULE_1_DIRECTION=user_to_dev
SYNC_RULE_1_CREATE_ISSUE=true
```

### Recommendation

**For this project: Option A (MongoDB)** - Runtime flexibility is key for sync configuration. Operators need to adjust rules without deployment cycles.

**If version control is priority: Option B (YAML)** - Best for audit trail and team review.

**Avoid Option C** due to security and deployment complexity.

## Background & Context

The current implementation in `src/sync/` has hardcoded logic:
- `sync-user-to-dev.ts`: Only triggers on "Will Do" status (creates Dev issue) and "Reopened" (mirrors to Dev)
- `sync-dev-to-user.ts`: Only mirrors "In Progress", "Closed", "Cancelled", "Reopened" statuses
- No flexibility for different project configurations or workflow requirements

This limits the service's adaptability across different team workflows and project setups.

## Goals

1. **Declarative Sync Rules**: Define sync behavior through configuration rather than code
2. **Runtime Flexibility**: Update sync rules without code deployment
3. **Direction Control**: Configure which direction(s) sync occurs for each status
4. **Extensible Design**: Support future enhancements (field mapping, custom transforms)

## Non-Goals

- Automatic discovery of Jira workflow statuses (manual configuration required)
- Complex field transformation logic (basic sync only)
- Real-time configuration push (configuration changes apply on next sync cycle)

## Proposed Solution

### Configuration Schema

Introduce a `SyncFlowConfig` document stored in MongoDB with the following structure:

```typescript
type SyncDirection = 'user_to_dev' | 'dev_to_user' | 'both' | 'none';

interface SyncRule {
  sourceStatus: string;          // Status in source project that triggers sync
  targetProject: 'dev' | 'user'; // Target project
  targetStatus?: string;         // Optional: map to different status in target (e.g., Dev "Closed" → User "Resolved")
  syncDirection: SyncDirection;  // When to sync
  enabled: boolean;              // Enable/disable rule
  actions?: {
    createIssue?: boolean;       // Create target issue if no mapping exists (uses source issueType)
    syncStatus?: boolean;        // Mirror/transition status to targetStatus
    syncAttachments?: boolean;   // Copy attachments to target issue
    addComment?: boolean;        // Add comment on sync
    commentTemplate?: string;    // Custom comment template (use ${sourceKey}, ${targetKey})
  };
}

interface SyncFlowConfig {
  _id: ObjectId;
  name: string;                  // Human-readable config name
  userProjectKey: string;
  devProjectKey: string;
  rules: SyncRule[];             // Ordered list of sync rules (first match wins)
  defaultBehavior: {
    syncAttachments: boolean;
    addCrossLinks: boolean;
  };
  created_at: Date;
  updated_at: Date;
}
```

**Ghi chú `targetStatus`:**
- Nếu không set: giữ nguyên status từ source
- Nếu set: chuyển sang status khác trong target project
- Ví dụ: Dev "Closed" → User "Resolved" (khác tên status)

### Default Configuration (Backward Compatible)

```json
{
  "name": "default",
  "description": "Cấu hình mặc định - giữ nguyên behavior hiện tại của sync flow",
  "userProjectKey": "USER",
  "devProjectKey": "DEV",
  "defaultBehavior": {
    "syncAttachments": true,
    "addCrossLinks": true,
    "onlyOnStatusChange": true
  },
  "rules": [
    {
      "sourceStatus": "Will Do",
      "targetProject": "dev",
      "syncDirection": "user_to_dev",
      "enabled": true,
      "description": "Khi User issue chuyển sang 'Will Do' và chưa có Dev issue → Tạo Dev issue mới",
      "actions": {
        "createIssue": true,
        "syncAttachments": true,
        "addCrossLink": true,
        "addComment": true,
        "commentTemplate": "Đã tạo Dev Issue: ${targetKey}"
      }
    },
    {
      "sourceStatus": "Reopened",
      "targetProject": "dev",
      "syncDirection": "user_to_dev",
      "enabled": true,
      "description": "Khi User issue chuyển sang 'Reopened' → Chuyển Dev issue sang 'Reopened'",
      "actions": {
        "syncStatus": true
      }
    },
    {
      "sourceStatus": "In Progress",
      "targetProject": "user",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "description": "Khi Dev issue chuyển sang 'In Progress' → Chuyển User issue sang 'In Progress'",
      "actions": {
        "syncStatus": true
      }
    },
    {
      "sourceStatus": "Closed",
      "targetProject": "user",
      "targetStatus": "Resolved",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "description": "Khi Dev issue chuyển sang 'Closed' → Resolve User issue + comment",
      "actions": {
        "syncStatus": true,
        "addCrossLink": true,
        "addComment": true,
        "commentTemplate": "Lỗi đã được xử lý tại issue ${sourceKey}"
      }
    },
    {
      "sourceStatus": "Cancelled",
      "targetProject": "user",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "description": "Khi Dev issue chuyển sang 'Cancelled' → Chuyển User issue sang 'Cancelled'",
      "actions": {
        "syncStatus": true
      }
    },
    {
      "sourceStatus": "Reopened",
      "targetProject": "user",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "description": "Khi Dev issue chuyển sang 'Reopened' → Chuyển User issue sang 'Reopened' + comment",
      "actions": {
        "syncStatus": true,
        "addComment": true,
        "commentTemplate": "Issue DEV ${sourceKey} đã được Reopened, cần xử lý lại"
      }
    }
  ]
}
```

**Ghi chú về flow hiện tại:**
- Dev→User chỉ chạy khi status thực sự thay đổi
- Dev "Done" bị bỏ qua (không trigger sync)
- Cross-links được thêm tự động vào description
- Khi tạo Dev issue mới, dùng issueType từ User issue gốc

### Implementation Approach

1. **Create SyncConfigModel**: Mongoose model for `sync_flow_config` collection
2. **Create SyncConfigRepository**: Data access layer for reading configuration
3. **Create ConfigLoader**: Service to load and cache configuration
4. **Refactor Sync Modules**: Update `sync-user-to-dev.ts` and `sync-dev-to-user.ts` to use configuration
5. **Create CLI/Admin Endpoint**: Tool to manage configuration (future)

### Key Design Decisions

1. **Database Storage**: Config in MongoDB allows runtime updates without deployment
2. **Rule Ordering**: Rules processed in order, first match wins for status triggers
3. **Backward Compatibility**: Default config maintains current behavior
4. **Lazy Loading**: Config loaded each sync cycle (no cache invalidation complexity)
5. **Validation**: Config validated on load, falls back to default if invalid

## Dependencies & Risks

### Dependencies
- MongoDB collection (new `sync_flow_config` collection)
- Configuration validation logic

### Risks
- **Complexity**: Adds configuration management overhead
- **Error Handling**: Invalid config could break sync; need fallback mechanism
- **Migration**: Existing deployments need initial config migration

## Timeline

- **Phase 1**: Data model and repository (1 day)
- **Phase 2**: Configuration loader service (1 day)
- **Phase 3**: Refactor sync-user-to-dev.ts (1 day)
- **Phase 4**: Refactor sync-dev-to-user.ts (1 day)
- **Phase 5**: Default config migration and testing (1 day)

**Total Estimate:** 5 days
