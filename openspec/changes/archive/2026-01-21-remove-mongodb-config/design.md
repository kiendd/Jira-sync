# Design: Remove MongoDB Configuration Dependency

**Change ID:** `remove-mongodb-config`

## Architectural Overview

This design removes the MongoDB-based configuration storage, simplifying the sync configuration to use only the embedded default configuration.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Simplified Sync Configuration                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │  Embedded Default   │                                                    │
│  │  (config-loader.ts) │                                                    │
│  └─────────────────────┘                                                    │
│           │                                                                 │
│           ▼                                                                 │
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

## Changes

### 1. Remove SyncConfigRepository

**File:** `src/db/sync-config-repo.ts`

**Action:** Delete entire file

**Impact:**
- No longer need `getConfigByName()`, `upsertConfig()`, `deleteConfig()`, etc.
- No database calls for configuration

### 2. Simplify ConfigLoader

**File:** `src/sync/config-loader.ts`

**Before:**
```typescript
async loadConfig(configName?: string): Promise<SyncFlowConfigDoc> {
  const name = configName || DEFAULT_CONFIG_NAME;
  const dbConfig = await syncConfigRepository.getConfigByName(name);
  if (!dbConfig) return this.defaultConfig;
  // ... validation and return
}
```

**After:**
```typescript
loadConfig(): SyncFlowConfigDoc {
  return this.defaultConfig;
}
```

**Changes:**
- Remove `syncConfigRepository` import
- Remove database calls
- Make `loadConfig()` synchronous (no async needed)
- Remove `validateConfig()` (only used for DB config)
- Keep `getDefaultConfig()` for tests

### 3. Remove Model Schema

**File:** `src/db/models.ts`

**Remove:**
- `SyncFlowConfigDoc` type (or keep for default config type)
- `SyncFlowConfigModel`
- `SyncRule` nested schemas (SyncRuleActionsSchema, SyncRuleConditionsSchema, SyncRuleSchema, SyncFlowConfigSchema)

**Keep:**
- `SyncRule` type (for default config)
- `SyncDirection` type (for rule matching)

### 4. Update Scheduler

**File:** `src/scheduler.ts`

**Before:**
```typescript
import { syncConfigLoader } from './sync/config-loader.js';
// ...
const syncConfig = await syncConfigLoader.loadConfig();
```

**After:**
```typescript
import { syncConfigLoader } from './sync/config-loader.js';
// ...
const syncConfig = syncConfigLoader.loadConfig();  // Synchronous
```

## Error Handling

### Before (Database Errors)
```typescript
try {
  const dbConfig = await syncConfigRepository.getConfigByName(name);
  // Handle DB errors
} catch (err) {
  logger.error({ err }, 'Failed to load sync config, using default');
  return this.defaultConfig;
}
```

### After (No Errors Possible)
```typescript
loadConfig(): SyncFlowConfigDoc {
  return this.defaultConfig;  // Always succeeds
}
```

## Data Migration

### No Data Migration Required

This change does not require data migration because:

1. The `sync_flow_config` collection is not critical data
2. It only contains configuration, not business data
3. Default behavior is preserved

### Optional Cleanup

Operators can optionally clean up after deployment:

```javascript
// MongoDB shell - optional
db.sync_flow_config.drop();
```

## Future Extensions

If file-based configuration is needed in the future:

```typescript
// Future: config-loader.ts with file support
loadConfig(): SyncFlowConfigDoc {
  const filePath = process.env.SYNC_CONFIG_PATH;
  if (filePath && fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return this.defaultConfig;
}
```

## Rollback Plan

1. Restore `src/db/sync-config-repo.ts` from git
2. Restore `SyncFlowConfigModel` in `src/db/models.ts`
3. Revert `src/sync/config-loader.ts` to previous version
4. Revert `src/scheduler.ts`

## Testing Strategy

1. **Build Test**: Verify TypeScript compilation
2. **Run Test**: Verify service starts without MongoDB config collection
3. **Behavior Test**: Verify sync still works with default config
