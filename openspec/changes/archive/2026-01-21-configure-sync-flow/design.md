# Design: Configure Sync Flow

**Change ID:** `configure-sync-flow`

## Architectural Overview

This design introduces a **Rule-Based Sync Engine** that replaces hardcoded sync logic with configurable rules stored in MongoDB.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Sync Configuration System                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │  SyncFlowConfig  │     │ ConfigRepository │     │  ConfigLoader    │   │
│  │     (Model)      │◄────│    (Repo)        │◄────│   (Service)      │   │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘   │
│           │                                               │                │
│           │                                               │                │
│           ▼                                               ▼                │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                    Sync Engine (Refactored)                      │     │
│  ├──────────────────────────────────────────────────────────────────┤     │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐  │     │
│  │  │ SyncUserToDev   │    │ SyncDevToUser   │    │ StatusMonitor│  │     │
│  │  │ (Config-Driven) │    │ (Config-Driven) │    │ (Unchanged)  │  │     │
│  │  └─────────────────┘    └─────────────────┘    └──────────────┘  │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. SyncFlowConfig Model

**Location:** `src/db/models.ts`

```typescript
interface SyncRule {
  sourceStatus: string;
  targetProject: 'dev' | 'user';
  targetStatus?: string;
  syncDirection: 'user_to_dev' | 'dev_to_user' | 'both' | 'none';
  enabled: boolean;
  actions: {
    createIssue?: boolean;
    syncStatus?: boolean;
    syncAttachments?: boolean;
    commentTemplate?: string;
  };
}

interface SyncFlowConfig {
  _id: ObjectId;
  name: string;
  userProjectKey: string;
  devProjectKey: string;
  rules: SyncRule[];
  defaultBehavior: {
    syncAttachments: boolean;
    addCrossLinks: boolean;
  };
  created_at: Date;
  updated_at: Date;
}
```

**Collection:** `sync_flow_config`

### 2. ConfigRepository

**Location:** `src/db/sync-config-repo.ts`

```typescript
export class SyncConfigRepository {
  async getActiveConfig(userProjectKey: string, devProjectKey: string): Promise<SyncFlowConfig | null>;
  async upsertConfig(config: SyncFlowConfig): Promise<void>;
  async deleteConfig(name: string): Promise<void>;
  async listConfigs(): Promise<SyncFlowConfig[]>;
}
```

### 3. ConfigLoader Service

**Location:** `src/sync/config-loader.ts`

```typescript
export class SyncConfigLoader {
  private defaultConfig: SyncFlowConfig;

  async loadConfig(): Promise<SyncFlowConfig>;
  validateConfig(config: unknown): config is SyncFlowConfig;
  getDefaultConfig(): SyncFlowConfig;
}
```

### 4. Refactored Sync Modules

**sync-user-to-dev.ts:**
```typescript
export const syncUserProjectToDevProject = async (
  lastSync: Date | null,
  config: SyncFlowConfig  // New parameter
): Promise<void> {
  const issues = await getUpdatedUserProjectIssues(lastSync);

  for (const issue of issues) {
    const statusName = issue.fields?.status?.name;
    const rule = findMatchingRule(config.rules, statusName, 'user_to_dev');

    if (!rule || !rule.enabled) continue;

    // Execute configured actions based on rule
    if (rule.actions.createIssue) {
      await createDevIssueForUserIssue(issue, rule);
    }
    if (rule.actions.syncStatus) {
      await syncReopenedStatus(issue, rule);
    }
  }
}
```

## Design Decisions & Trade-offs

### Decision 1: Database vs File Configuration

**Choice:** Database storage

**Rationale:**
- Allows runtime updates without deployment
- Centralized management for multi-instance deployments
- Existing MongoDB infrastructure

**Alternative Considered:** JSON files in repository
- Would require deployment for config changes
- No runtime flexibility

### Decision 2: Rule Matching Strategy

**Choice:** First-match-wins with ordered rules

**Rationale:**
- Simple to understand and debug
- Allows overrides by placing specific rules first
- Maintains predictable execution order

**Alternative Considered:** All-matching with priority
- More complex matching logic
- Harder to predict behavior

### Decision 3: Default Configuration Approach

**Choice:** Embedded default config with fallback

**Rationale:**
- Backward compatibility guaranteed
- No migration required for existing deployments
- Serviceable even if config collection is empty

**Alternative Considered:** Required initial config migration
- Adds deployment complexity
- Risk of broken sync if migration fails

### Decision 4: Configuration Validation

**Choice:** Validate on load, fallback to default if invalid

**Rationale:**
- Service continues even with bad config
- Clear error logging for operators
- Safe default behavior

**Alternative Considered:** Fail fast on invalid config
- Would stop all sync operations
- Higher operational risk

## Sync Flow Examples

### Example 1: Default Configuration (Current Behavior)

```json
{
  "name": "default",
  "rules": [
    {
      "sourceStatus": "Will Do",
      "targetProject": "dev",
      "syncDirection": "user_to_dev",
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
      "actions": {
        "syncStatus": true
      }
    },
    {
      "sourceStatus": "In Progress",
      "targetProject": "user",
      "syncDirection": "dev_to_user",
      "actions": {
        "syncStatus": true
      }
    },
    {
      "sourceStatus": "Closed",
      "targetProject": "user",
      "targetStatus": "Resolved",
      "syncDirection": "dev_to_user",
      "actions": {
        "syncStatus": true,
        "addComment": true,
        "commentTemplate": "Lỗi đã được xử lý tại issue ${sourceKey}"
      }
    },
    {
      "sourceStatus": "Cancelled",
      "targetProject": "user",
      "syncDirection": "dev_to_user",
      "actions": {
        "syncStatus": true
      }
    },
    {
      "sourceStatus": "Reopened",
      "targetProject": "user",
      "syncDirection": "dev_to_user",
      "actions": {
        "syncStatus": true,
        "addComment": true,
        "commentTemplate": "Issue DEV ${sourceKey} đã được Reopened, cần xử lý lại"
      }
    }
  ]
}
```

**Current behavior notes:**
- Dev→User only triggers on actual status change
- Dev "Done" status is skipped (intermediate)
- Cross-links added to descriptions automatically
- New Dev issues inherit source issueType

### Example 2: Unidirectional Sync

```json
{
  "rules": [
    {
      "sourceStatus": "In Progress",
      "targetProject": "user",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "actions": { "syncStatus": true }
    }
  ]
}
```

**Behavior:** Only sync Dev "In Progress" to User, never the reverse.

### Example 3: Custom Status Mapping

```json
{
  "rules": [
    {
      "sourceStatus": "Fixed",
      "targetProject": "user",
      "targetStatus": "Resolved",
      "syncDirection": "dev_to_user",
      "enabled": true,
      "actions": { "syncStatus": true }
    }
  ]
}
```

**Behavior:** When Dev issue is "Fixed", sync to User as "Resolved".

## Error Handling

### Invalid Configuration
```
ConfigLoader loads default config
Logger.warn({ reason: 'validation_error' }, 'Invalid config, using default')
```

### Missing Mapping
```
Rule matches but no issue mapping exists
If createIssue action: create new issue
If no createIssue action: skip with warning
```

### Failed API Call
```
Jira API error during sync
Logger.error({ err, issueKey }, 'Sync action failed')
Continue processing remaining issues
```

## Testing Strategy

1. **Unit Tests**: ConfigLoader validation, rule matching logic
2. **Integration Tests**: Full sync cycle with various config combinations
3. **Manual Testing**: Verify backward compatibility with default config
4. **Configuration CRUD**: Test config create, read, update, delete operations

## Future Extensions

- **Field Mapping**: Add `fieldMappings` to rules for custom field sync
- **Transform Functions**: Support JS transforms for field values
- **Webhook Support**: Push config changes to running instances
- **Config Versioning**: Track config history and rollback capability
