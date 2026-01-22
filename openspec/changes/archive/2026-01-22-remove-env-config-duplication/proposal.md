# remove-env-config-duplication

## Summary

Remove all JIRA environment variables from the application. Use JSON config files as the **only** configuration source for JIRA credentials and project keys. This enables running multiple workers with different JIRA configurations simultaneously.

## Problem Statement

The `docker-compose.yml` file contains JIRA environment variables (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `USER_PROJECT_KEY`, `DEV_PROJECT_KEY`), but these values are also defined in JSON config files (`config/sync-*.json`). This duplication:

- Causes confusion about where to configure credentials
- Makes maintenance harder (changes must be made in multiple places)
- Violates DRY principle
- Prevents running multiple workers with different JIRA instances (single env var set can't serve multiple workers)
- Workers already override global config with JSON file values, making env vars redundant

## Key Requirement: No Fallback

**There will be NO fallback to environment variables.** All JIRA configuration must come from JSON config files. This is intentional to:

1. Enable multiple workers with different JIRA credentials
2. Eliminate confusion about configuration source
3. Enforce single source of truth
4. Simplify code by removing fallback complexity

## Root Cause Analysis

### Current Configuration Flow

```
src/config/index.ts
├── requireEnv('JIRA_BASE_URL')  ← Crashes if missing
├── requireEnv('JIRA_API_TOKEN') ← Crashes if missing
├── requireEnv('USER_PROJECT_KEY') ← Crashes if missing
├── requireEnv('DEV_PROJECT_KEY') ← Crashes if missing
└── Used by main process before worker spawn
```

### Where Config Values Are Used

| Location | Config Source | Env Vars Used |
|----------|---------------|---------------|
| Main process startup | `src/config/index.ts` | Yes (required) |
| Worker config loading | `src/sync/worker.ts` | No (from JSON) |
| ConfigLoader fallback | `src/sync/config-loader.ts:17-22` | Yes (fallback only) |

### Why Duplication Exists

1. **Legacy Architecture**: Original single-worker design used env vars for all config
2. **No JSON-first approach**: Main process requires env vars before checking JSON configs
3. **Fallback complexity**: `applyEnvFallback()` adds unnecessary code paths

## Proposed Solution: Full File-Based Config

Remove all JIRA environment variables from the codebase. JSON config files are the **only** source of truth for JIRA configuration.

### Architecture After Change

```
┌─────────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ environment:                                            │   │
│  │   DATABASE_URL: mongodb://mongo:27017    ← KEEP        │   │
│  │   SYNC_INTERVAL_MINUTES: ${SYNC_INTERVAL_MINUTES}       │   │
│  │   LOG_LEVEL: ${LOG_LEVEL}                 ← KEEP       │   │
│  │   PORT: ${PORT}                           ← KEEP       │   │
│  │   CONFIG_DIR: /app/config                 ← KEEP       │   │
│  │   # NO JIRA_* variables                   ← REMOVED    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    src/config/index.ts                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ # No JIRA env vars loaded                               │   │
│  │ # Only non-JIRA config: LOG_LEVEL, PORT, etc.          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    src/sync/config-loader.ts                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ loadConfigsFromDirectory()                              │   │
│  │   ↓                                                     │   │
│  │ Load all config/sync-*.json files                       │   │
│  │   ↓                                                     │   │
│  │ Each worker gets its own JIRA credentials               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐    ┌─────────┐    ┌─────────┐
        │Worker AB│    │Worker CD│    │Worker XY│
        │Jira A   │    │Jira B   │    │Jira C   │
        └─────────┘    └─────────┘    └─────────┘
```

### Benefits

1. **Multiple JIRA Instances**: Run workers connecting to different Jira instances simultaneously
2. **Single Source of Truth**: No confusion about where config comes from
3. **Cleaner Code**: No fallback logic, no env var validation
4. **Easier Maintenance**: All config in version-controlled JSON files
5. **Environment Isolation**: Dev/test/prod configs as separate files

## Scope

### In Scope
- `docker-compose.yml` - Remove all JIRA environment variables
- `src/config/index.ts` - Remove JIRA env var loading entirely
- `src/sync/config-loader.ts` - Remove fallback logic
- `src/sync/worker.ts` - Simplify worker config loading
- `DEPLOY.md` - Update documentation for file-based config only
- `.env.example` - Remove JIRA variables

### Out of Scope
- Changes to JSON config file format
- Changes to sync logic
- Changes to database models

## Dependencies

None - this change is self-contained.

## Testing Strategy

1. Verify service starts without JIRA env vars when JSON configs exist
2. Verify service fails with clear error when no JSON config files
3. Verify multiple workers start with different JIRA configs
4. Verify health endpoint returns correct status
5. Verify sync operations work correctly with file-based config

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing deployments | High | Clear migration docs, version bump |
| No fallback causes startup failures | Medium | Clear error messages |
| Invalid JSON config causes failures | Medium | Validation before startup |

## Migration Path for Existing Deployments

1. Create JSON config file from current env vars
2. Place in `config/` directory
3. Remove JIRA env vars from docker-compose.yml / .env
4. Restart service

## Timeline

- **Proposal**: 1 day
- **Implementation**: 2-3 days
- **Testing**: 1 day
- **Documentation**: 0.5 day

**Total estimated: 4-5 days**
