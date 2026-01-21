# Tasks: Remove MongoDB Configuration Dependency

**Change ID:** `remove-mongodb-config`

**Total Estimate:** 1 day

## TASK-001: Remove SyncConfigRepository
- **Estimate:** 0.25 day
- **Status:** Completed
- **Description:** Delete `src/db/sync-config-repo.ts` file
- **Validation:** File is deleted, no imports reference it
- **Dependencies:** None

## TASK-002: Remove SyncFlowConfigModel from Models
- **Estimate:** 0.25 day
- **Status:** Completed
- **Description:** Remove `SyncFlowConfigModel`, `SyncFlowConfigSchema`, and related schemas from `src/db/models.ts`
- **Validation:** TypeScript compiles, model is removed
- **Dependencies:** TASK-001

## TASK-003: Simplify ConfigLoader
- **Estimate:** 0.25 day
- **Status:** Completed
- **Description:** Update `src/sync/config-loader.ts` to remove database calls and return default config synchronously
- **Validation:** ConfigLoader always returns default config, no DB dependencies
- **Dependencies:** TASK-001

## TASK-004: Update Scheduler Import
- **Estimate:** 0.1 day
- **Status:** Completed
- **Description:** Update `src/scheduler.ts` to use synchronous `loadConfig()` call
- **Validation:** Scheduler works with simplified ConfigLoader
- **Dependencies:** TASK-003

## TASK-005: Clean Up Repo Exports
- **Estimate:** 0.1 day
- **Status:** Completed
- **Description:** Remove unused exports from `src/db/repo.ts` if any
- **Validation:** No unused imports/exports in repo.ts
- **Dependencies:** TASK-002

## TASK-006: Build and Verify
- **Estimate:** 0.1 day
- **Status:** Completed
- **Description:** Run npm run build and npm run lint
- **Validation:** Build succeeds, lint passes
- **Dependencies:** All tasks

## Dependency Graph

```
TASK-001 ──┐
           │
TASK-002 ──┼──> TASK-003 ──┬──> TASK-004
                         │
                         └──> TASK-005
                                  │
                         TASK-006 ◄──┘
```

## Parallelization Opportunities

- **TASK-001 and TASK-002**: Can be done in parallel

## Validation Commands

```bash
# Type checking
npm run lint

# Build
npm run build

# Verify no MongoDB config dependency
grep -r "sync-config-repo" src/
# Should return no results

grep -r "SyncFlowConfigModel" src/
# Should only return type definitions, not model usage
```

## Rollback Plan

If issues arise:
1. `git checkout HEAD -- src/db/sync-config-repo.ts` to restore repository
2. `git checkout HEAD -- src/db/models.ts` to restore model
3. `git checkout HEAD -- src/sync/config-loader.ts` to restore loader
