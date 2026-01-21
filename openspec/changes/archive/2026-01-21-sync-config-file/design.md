# Design: Sync Configuration File

**Change ID:** `sync-config-file`

## Architectural Overview

This design changes the sync configuration storage from MongoDB to a local JSON file.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      File-Based Sync Configuration                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐         ┌─────────────────────┐                   │
│  │  sync-rules.json    │         │   ConfigLoader      │                   │
│  │  (config directory) │ ──────► │   (File-based)      │                   │
│  └─────────────────────┘         └─────────────────────┘                   │
│                                         │                                    │
│                                         ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                    Sync Engine (Unchanged)                       │     │
│  ├──────────────────────────────────────────────────────────────────┤     │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐  │     │
│  │  │ SyncUserToDev   │    │ SyncDevToUser   │    │ StatusMonitor│  │     │
│  │  └─────────────────┘    └─────────────────┘    └──────────────┘  │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Configuration File

**Location:** `config/sync-rules.json`

```typescript
interface SyncRule {
  sourceStatus: string;
  targetProject: 'dev' | 'user';
  targetStatus?: string;
  syncDirection: 'user_to_dev' | 'dev_to_user' | 'both' | 'none';
  enabled: boolean;
  priority?: number;
  description?: string;
  conditions?: {
    requireMapping?: boolean;
    onStatusChange?: boolean;
  };
  actions?: {
    createIssue?: boolean;
    syncStatus?: boolean;
    syncAttachments?: boolean;
    addComment?: boolean;
    addCrossLink?: boolean;
    commentTemplate?: string;
    targetStatus?: string;
  };
}

interface SyncFlowConfig {
  name: string;
  userProjectKey: string;
  devProjectKey: string;
  defaultBehavior?: {
    syncAttachments?: boolean;
    addCrossLinks?: boolean;
    onlyOnStatusChange?: boolean;
    skipIntermediateStatuses?: boolean;
  };
  rules: SyncRule[];
}
```

### 2. ConfigLoader Changes

**Location:** `src/sync/config-loader.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'json5';  // More forgiving JSON parsing

const CONFIG_PATH = process.env.SYNC_CONFIG_PATH || 'config/sync-rules.json';

export class SyncConfigLoader {
  private defaultConfig: SyncFlowConfig;

  constructor() {
    this.defaultConfig = getEmbeddedDefaultConfig();
  }

  async loadConfig(): Promise<SyncFlowConfig> {
    try {
      const absolutePath = path.resolve(CONFIG_PATH);

      if (!fs.existsSync(absolutePath)) {
        logger.info({ path: absolutePath }, 'Config file not found, using default');
        return this.defaultConfig;
      }

      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      const config = parse(fileContent);  // Allow comments in JSON

      if (!this.validateConfig(config)) {
        logger.warn({ path: absolutePath }, 'Invalid config file, using default');
        return this.defaultConfig;
      }

      logger.info({ path: absolutePath }, 'Loaded sync config from file');
      return config;
    } catch (err) {
      logger.error({ err }, 'Failed to load config file, using default');
      return this.defaultConfig;
    }
  }

  private validateConfig(config: unknown): config is SyncFlowConfig {
    // Same validation logic as before
  }
}
```

### 3. Removed Components

The following are no longer needed:
- `src/db/sync-config-repo.ts` - Repository class
- `sync_flow_config` MongoDB collection

## Design Decisions

### Decision 1: JSON5 for Parsing

**Choice:** Use `json5` library or native parsing with comments stripped

**Rationale:**
- JSON5 allows comments in config files
- More forgiving syntax (trailing commas)
- Better error messages

**Alternative Considered:** Standard `JSON.parse`
- Requires strict JSON (no comments)
- Less user-friendly

### Decision 2: Config File Location

**Choice:** `config/sync-rules.json` with `SYNC_CONFIG_PATH` env var override

**Rationale:**
- Follows project convention (other configs in `config/`)
- Environment variable allows Docker/K8s config maps
- Default location is obvious

**Alternative Considered:** Fixed path in project root
- Less flexible for deployments

### Decision 3: Hot Reload

**Choice:** Load config on each sync cycle (no caching)

**Rationale:**
- Simple implementation
- Changes picked up within 5 minutes (sync interval)
- No file watching complexity

**Alternative Considered:** File watcher for hot reload
- More complex
- Unnecessary for sync use case

### Decision 4: Validation Strategy

**Choice:** Validate on load, fallback to embedded defaults

**Rationale:**
- Service continues even with bad config
- Clear error logging
- Safe default behavior

**Alternative Considered:** Fail fast
- Would stop all sync operations
- Higher operational risk

## Error Handling

### File Not Found
```
ConfigLoader uses default config
Logger.info({ path }, 'Config file not found, using default')
```

### Invalid JSON
```
ConfigLoader uses default config
Logger.error({ err, path }, 'Failed to parse config file, using default')
```

### Validation Failed
```
ConfigLoader uses default config
Logger.warn({ path, reason }, 'Invalid config file, using default')
```

## File Watching (Optional Future)

If hot reload is needed in the future:

```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch(CONFIG_PATH, { persistent: true });
watcher.on('change', () => {
  logger.info({ path: CONFIG_PATH }, 'Config file changed, reloading');
  syncConfigLoader.reload();
});
```

## Migration Guide

### Step 1: Export Current Config

```javascript
// From MongoDB shell
db.sync_flow_config.find().forEach(function(doc) {
  print(JSON.stringify(doc, null, 2));
});
```

### Step 2: Save to File

Save the exported JSON to `config/sync-rules.json` (remove `_id`, `created_at`, `updated_at`)

### Step 3: Verify

Restart the service and verify sync behavior works as expected.

### Step 4: Cleanup (Optional)

```javascript
// From MongoDB shell
db.sync_flow_config.drop();
```

## Testing Strategy

1. **File Reading Tests**: Verify file loading with valid/invalid/missing files
2. **JSON5 Parsing Tests**: Verify comments and trailing commas work
3. **Validation Tests**: Verify invalid configs fall back to defaults
4. **Integration Test**: Full sync cycle with file-based config
