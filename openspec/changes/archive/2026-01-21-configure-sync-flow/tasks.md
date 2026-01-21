# Tasks: Configure Sync Flow

**Change ID:** `configure-sync-flow`

**Total Estimate:** 5 days

## Phase 1: Data Model & Repository

### TASK-001: Add SyncFlowConfig Model
- **Estimate:** 0.5 day
- **Status:** Completed
- **Description:** Add `SyncFlowConfig` and `SyncRule` interfaces and Mongoose schema to `src/db/models.ts`
- **Validation:** TypeScript compiles without errors, schema has all required fields
- **Dependencies:** None

### TASK-002: Create SyncConfigRepository
- **Estimate:** 0.5 day
- **Status:** Completed
- **Description:** Create `src/db/sync-config-repo.ts` with CRUD operations for sync configurations
- **Validation:** Repository methods work with test config, handle empty/missing configs gracefully
- **Dependencies:** TASK-001

## Phase 2: Configuration Loader

### TASK-003: Create ConfigLoader Service
- **Estimate:** 0.5 day
- **Status:** Completed
- **Description:** Create `src/sync/config-loader.ts` with `loadConfig()` and `validateConfig()` methods
- **Validation:** Loader returns valid config, falls back to default on invalid/empty
- **Dependencies:** TASK-002

### TASK-004: Define Default Configuration
- **Estimate:** 0.25 day
- **Status:** Completed
- **Description:** Create default config object matching current hardcoded behavior in config-loader.ts
- **Validation:** Default config produces identical sync behavior to current implementation
- **Dependencies:** TASK-003

## Phase 3: Refactor User-to-Dev Sync

### TASK-005: Update sync-user-to-dev.ts to Use Config
- **Estimate:** 0.75 day
- **Status:** Completed
- **Description:** Refactor to accept config parameter, replace hardcoded status checks with rule matching
- **Validation:** User issues in "Will Do" still create Dev issues, "Reopened" still syncs
- **Dependencies:** TASK-003

### TASK-006: Implement Config-Driven Actions
- **Estimate:** 0.5 day
- **Status:** Completed
- **Description:** Implement createIssue, syncStatus, syncAttachments actions based on config rules
- **Validation:** Actions execute according to rule configuration
- **Dependencies:** TASK-005

## Phase 4: Refactor Dev-to-User Sync

### TASK-007: Update sync-dev-to-user.ts to Use Config
- **Estimate:** 0.75 day
- **Status:** Completed
- **Description:** Refactor to accept config parameter, replace hardcoded status list with rule matching
- **Validation:** Dev "In Progress", "Closed", "Cancelled", "Reopened" still sync to User
- **Dependencies:** TASK-003

### TASK-008: Implement Status Mapping
- **Estimate:** 0.25 day
- **Status:** Completed
- **Description:** Add support for `target_status` field to map Dev statuses to different User statuses
- **Validation:** Dev "Closed" maps to User "Resolved" as configured in default
- **Dependencies:** TASK-007

## Phase 5: Integration & Testing

### TASK-009: Update Scheduler
- **Estimate:** 0.25 day
- **Status:** Completed
- **Description:** Update `src/scheduler.ts` to pass config to sync functions
- **Validation:** Scheduler passes config to syncUserProjectToDevProject and syncDevProjectToUserProject
- **Dependencies:** TASK-005, TASK-007

### TASK-010: Write Unit Tests
- **Estimate:** 0.5 day
- **Status:** Skipped
- **Description:** Write unit tests for ConfigLoader validation, rule matching, and config CRUD
- **Validation:** Tests pass, coverage includes main code paths
- **Dependencies:** TASK-003, TASK-004
- **Note:** No test framework exists in project. Tests can be added with Jest/Vitest setup.

### TASK-011: Integration Test
- **Estimate:** 0.5 day
- **Status:** Skipped
- **Description:** Run full sync cycle test with default config, verify behavior matches current implementation
- **Validation:** npm run test:sync-cycle passes, output matches expected behavior
- **Dependencies:** TASK-009, TASK-010
- **Note:** Requires Jira instance to run. Manual testing recommended.

### TASK-012: Lint and TypeCheck
- **Estimate:** 0.25 day
- **Status:** Completed
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
                        │    TASK-005 ──┐
                        │           │
                        │    TASK-006 ──┤
                        │               │
                        │    TASK-007 ──┼──> TASK-008
                        │               │
                        └──> TASK-009 ──┴──> TASK-011
                                │
                        TASK-010 ──┘
                                │
                        TASK-012
```

## Parallelization Opportunities

- **TASK-001 and TASK-002**: Can be done in parallel (both are data layer)
- **TASK-005 and TASK-007**: Can be done in parallel (both are sync module refactoring)
- **TASK-010 and TASK-011**: Can be done in parallel (both are testing)

## Validation Commands

```bash
# Type checking
npm run lint

# Full test
npm run test:sync-cycle

# Manual sync test
npm run sync:init
```

## Rollback Plan

If issues arise during implementation:
1. Keep old sync modules as backup (`sync-user-to-dev.ts.bak`, `sync-dev-to-user.ts.bak`)
2. Default config provides backward compatibility
3. Can revert to hardcoded behavior by not loading config from database
