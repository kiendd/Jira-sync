# Tasks: worker-initial-sync

## Phase 1: Analysis & Planning

- [x] 1.1 Document current sync flow (DONE)
- [x] 1.2 Identify all files using getLastSync/updateLastSync
- [x] 1.3 Review sync function signatures for parameter changes

## Phase 2: Data Model Changes

### 2.1 Update SyncStateDoc in models.ts

- [x] 2.1.1 Add `initial_sync_completed: boolean` field
- [x] 2.1.2 Add `created_at` and `updated_at` timestamps
- [x] 2.1.3 Update SyncStateSchema to include new fields

### 2.2 Add initialSyncEnabled to SyncFlowConfigDoc

- [x] 2.2.1 Add optional `initialSyncEnabled?: boolean` field
- [x] 2.2.2 Document the field in types

## Phase 3: Repository Changes

### 3.1 Add new repository functions

- [x] 3.1.1 Add `getSyncState(name: string)` function
- [x] 3.1.2 Add `markInitialSyncCompleted(name: string)` function
- [x] 3.1.3 Update `updateLastSync` to accept optional name parameter

### 3.2 Export new functions

- [x] 3.2.1 Export new functions from db/index.ts (implicit via repo.ts)
- [ ] 3.2.2 Add tests for new repository functions (out of scope)

## Phase 4: Scheduler Changes

### 4.1 Update runSyncCycle

- [x] 4.1.1 Replace `getLastSync()` with `getSyncState(name)`
- [x] 4.1.2 Check `initial_sync_completed` flag
- [x] 4.1.3 Determine `doFullSync` based on state
- [x] 4.1.4 Add logging for sync mode (full vs incremental)
- [x] 4.1.5 Call `markInitialSyncCompleted()` after full sync

### 4.2 Update startScheduler

- [x] 4.2.1 Pass worker name to runSyncCycle
- [x] 4.2.2 Handle config with/without worker name

## Phase 5: Sync Function Updates

### 5.1 Update sync-user-to-dev.ts

- [x] 5.1.1 Add `doFullSync: boolean` parameter
- [x] 5.1.2 Pass `doFullSync` to Jira queries
- [x] 5.1.3 Update JQL to skip time filter when doFullSync is true

### 5.2 Update sync-dev-to-user.ts

- [x] 5.2.1 Add `doFullSync: boolean` parameter
- [x] 5.2.2 Pass `doFullSync` to Jira queries
- [x] 5.2.3 Update JQL to skip time filter when doFullSync is true

## Phase 6: Jira Client Changes

### 6.1 Update searchIssues

- [x] 6.1.1 Add `ignoreTimeFilter?: boolean` parameter
- [x] 6.1.2 Skip JQL time filter when `ignoreTimeFilter` is true
- [x] 6.1.3 Keep backward compatibility (existing calls work)

### 6.2 Update caller functions

- [x] 6.2.1 Update `getUpdatedUserProjectIssues` signature
- [x] 6.2.2 Update `getUpdatedDevProjectIssues` signature
- [x] 6.2.3 Pass `doFullSync` / `ignoreTimeFilter` appropriately

## Phase 7: Configuration Updates

### 7.1 Update config-loader.ts

- [x] 7.1.1 Support `initialSyncEnabled` in JSON config (automatic via SyncFlowConfigDoc)
- [x] 7.1.2 Default to `true` if not specified
- [x] 7.1.3 Pass config to scheduler

## Phase 8: Testing

### 8.1 Unit Tests

- [ ] 8.1.1 Test getSyncState with existing state
- [ ] 8.1.2 Test getSyncState with null state
- [ ] 8.1.3 Test markInitialSyncCompleted
- [ ] 8.1.4 Test sync mode determination logic

### 8.2 Integration Tests

- [ ] 8.2.1 Test first run: full sync happens, flag set
- [ ] 8.2.2 Test restart: incremental sync, no full resync
- [ ] 8.2.3 Test state loss: warning logged, incremental sync
- [ ] 8.2.4 Test config override: initialSyncEnabled = false

### 8.3 Manual Testing

- [ ] 8.3.1 Fresh deployment test
- [ ] 8.3.2 Worker restart test
- [ ] 8.3.3 Database state clear test
- [ ] 8.3.4 Multiple workers isolation test

## Phase 9: Documentation

- [ ] 9.1 Update DEPLOY.md with initial sync behavior
- [ ] 9.2 Document `initialSyncEnabled` config option
- [ ] 9.3 Add troubleshooting section for sync issues

## Phase 10: Validation

- [x] 10.1 Run `openspec validate worker-initial-sync`
- [x] 10.2 Run `npm run lint`
- [x] 10.3 Run `npm run build`
- [ ] 10.4 Final review and merge
