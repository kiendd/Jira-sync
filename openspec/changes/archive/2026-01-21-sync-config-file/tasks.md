# Tasks: Sync Configuration File

**Change ID:** `sync-config-file`

**Total Estimate:** 1.25 days

## TASK-001: Create Example Config File
- **Estimate:** 0.25 day
- **Status:** Pending
- **Description:** Create `config/sync-rules.json` with default sync rules (current behavior)
- **Validation:** File is valid JSON, contains all current sync rules
- **Dependencies:** None

## TASK-002: Add json5 Dependency
- **Estimate:** 0.1 day
- **Status:** Pending
- **Description:** Add `json5` package to allow comments in JSON config
- **Validation:** npm install succeeds, json5 can be imported
- **Dependencies:** None

## TASK-003: Refactor ConfigLoader for File Reading
- **Estimate:** 0.5 day
- **Status:** Pending
- **Description:** Update `src/sync/config-loader.ts` to read from file system instead of MongoDB
- **Validation:** ConfigLoader reads from file, falls back to embedded defaults if file missing/invalid
- **Dependencies:** TASK-001, TASK-002

## TASK-004: Update Scheduler
- **Estimate:** 0.15 day
- **Status:** Pending
- **Description:** Update `src/scheduler.ts` to use file-based ConfigLoader
- **Validation:** Scheduler loads config from file on each sync cycle
- **Dependencies:** TASK-003

## TASK-005: Remove or Deprecate SyncConfigRepository
- **Estimate:** 0.1 day
- **Status:** Pending
- **Description:** Remove or mark as deprecated `src/db/sync-config-repo.ts`
- **Validation:** Repository is no longer imported/used
- **Dependencies:** TASK-003

## TASK-006: Update Documentation
- **Estimate:** 0.1 day
- **Status:** Pending
- **Description:** Update AGENTS.md and README.md with file-based config documentation
- **Validation:** Documentation explains config file location and format
- **Dependencies:** All tasks

## TASK-007: Lint and TypeCheck
- **Estimate:** 0.05 day
- **Status:** Pending
- **Description:** Run npm run lint and fix any type errors
- **Validation:** npm run lint passes without errors
- **Dependencies:** All tasks

## Dependency Graph

```
TASK-001 ──┐
           │
TASK-002 ──┼──> TASK-003 ──┬──> TASK-004
                         │           │
                         │           ▼
                         │    TASK-005
                         │
                         └────> TASK-006
                                      │
                         TASK-007 ◄──┘
```

## Parallelization Opportunities

- **TASK-001 and TASK-002**: Can be done in parallel
- **TASK-004 and TASK-005**: Can be done in parallel after TASK-003

## Validation Commands

```bash
# Type checking
npm run lint

# Build
npm run build

# Test with custom config path
SYNC_CONFIG_PATH=config/sync-rules.json npm start
```

## Rollback Plan

If issues arise:
1. Set `SYNC_CONFIG_PATH` to non-existent file to use embedded defaults
2. Restore `SyncConfigRepository` if file-based approach is reverted
3. Keep repository code as backup until confident

## Migration from Database Config

Instructions for existing deployments:
1. Export `sync_flow_config` collection to JSON
2. Remove MongoDB-specific fields (`_id`, `created_at`, `updated_at`)
3. Save to `config/sync-rules.json`
4. Restart service
5. (Optional) Drop `sync_flow_config` collection
