# Tasks

## Phase 1: Add Issue Details to Existing Logs

### Task 1.1: Update sync-user-to-dev.ts logging

**File:** `src/sync/sync-user-to-dev.ts`

**Changes:**
- Add `issueTitle` to all log entries
- Add `fromStatus` and `toStatus` for status sync logs
- Include `ruleId` for traceable decisions
- Add `action` field to indicate action type

**Validation:**
- [x] `npm run lint` - no errors
- [x] `npm run build` - succeeds

### Task 1.2: Update sync-dev-to-user.ts logging

**File:** `src/sync/sync-dev-to-user.ts`

**Changes:**
- Add `issueTitle` to all log entries
- Add `fromStatus` and `toStatus` for status sync logs
- Include `ruleId` for traceable decisions
- Add `action` field to indicate action type

**Validation:**
- [x] `npm run lint` - no errors
- [x] `npm run build` - succeeds

### Task 1.3: Update monitor-all-projects.ts logging

**File:** `src/sync/monitor-all-projects.ts`

**Changes:**
- Log fetched issue count with project type
- Add `issueTitle` when available
- Include `updatedAt` timestamp

**Validation:**
- [x] `npm run lint` - no errors
- [x] `npm run build` - succeeds

## Phase 2: Add New Audit Log Events

### Task 2.1: Create issue processing logger utility

**New File:** `src/sync/audit-logger.ts`

**Changes:**
- Create helper functions for structured audit logging
- Define log event types: `issue.fetched`, `issue.processed`, `status.changed`, `action.*`
- Include all required fields per spec
- Create `SyncMetrics` class for tracking cycle metrics

**Validation:**
- [x] `npm run lint` - no errors
- [x] `npm run build` - succeeds

### Task 2.2: Add issue.fetched logging

**Files:** `src/sync/sync-user-to-dev.ts`, `src/sync/sync-dev-to-user.ts`

**Changes:**
- Add `issue.fetched` log when fetching issues from Jira
- Include `issueKey`, `issueTitle`, `projectType`, `currentStatus`, `updatedAt`

**Validation:**
- [x] `npm run lint` - no errors
- [x] `npm run build` - succeeds

### Task 2.3: Add status.changed logging

**File:** `src/sync/issue-state-tracker.ts`

**Changes:**
- Enhance `detectStatusChange()` to log full transition
- Include `fromStatus`, `toStatus`, `isNewIssue`, `timestamp`
- Add `status.unchanged` debug log for issues without change

**Validation:**
- [x] `npm run lint` - no errors
- [x] `npm run build` - succeeds

### Task 2.4: Add action execution logging

**Files:** `src/sync/sync-user-to-dev.ts`, `src/sync/sync-dev-to-user.ts`

**Changes:**
- Add `action.createIssue` log when creating issues
- Add `action.syncStatus` log when syncing status
- Add `action.skipped` log when skipping issues with reason

**Validation:**
- [x] `npm run lint` - no errors
- [x] `npm run build` - succeeds

## Phase 3: Add Sync Cycle Summary

### Task 3.1: Create sync cycle summary logger

**File:** `src/sync/scheduler.ts`

**Changes:**
- Track metrics during sync cycle:
  - `issuesFetched`, `statusChangesDetected`
  - `issuesCreated`, `statusesSynced`
  - `issuesSkipped`, `errors`
- Log `sync.cycle.completed` event at end of cycle
- Include `durationMs` for performance tracking

**Validation:**
- [x] `npm run lint` - no errors
- [x] `npm run build` - succeeds

### Task 3.2: Add error tracking to cycle summary

**File:** `src/sync/scheduler.ts`

**Changes:**
- Catch and count errors during sync
- Include error details in summary
- Add `errorCount` and `firstError` fields

**Validation:**
- [x] `npm run lint` - no errors
- [x] `npm run build` - succeeds

## Phase 4: Validation and Testing

### Task 4.1: Manual testing of audit logs

**Test Cases:**
- [x] Start sync service and verify logs appear
- [x] Trigger issue creation and verify `action.createIssue` log
- [x] Trigger status change and verify `status.changed` log
- [x] Verify `sync.cycle.completed` summary at end

**Expected Log Output:**
```json
{"level":"info","event":"issue.processed","issueKey":"FSNX-230","issueTitle":"Login button broken","projectType":"user","currentStatus":"Will Do","ruleId":"user-will-do","action":"createIssue","targetKey":"DC5SNX-123"}

{"level":"info","event":"status.changed","issueKey":"FSNX-230","projectType":"user","fromStatus":"Open","toStatus":"Will Do","isNewIssue":true}

{"level":"info","event":"sync.cycle.completed","worker":"sync-snx","durationMs":1523,"issuesFetched":10,"statusChangesDetected":3,"issuesCreated":2,"statusesSynced":1,"issuesSkipped":4,"errors":0}
```

### Task 4.2: Update documentation

**File:** `AGENTS.md`

**Changes:**
- [x] Document new audit logging events
- [x] Provide example log outputs
- [x] Explain log structure and fields

## Summary

All tasks completed successfully. The system now provides:

1. **Detailed Issue Logging**: Every issue is logged with key, title, status, and project type
2. **Status Change Tracking**: Full transition details (from→to) with timestamps
3. **Action Execution Logging**: Clear logs for create/sync/skip actions with reasons
4. **Sync Cycle Summary**: Comprehensive metrics at end of each cycle

### New Log Events

| Event | Description |
|-------|-------------|
| `issue.fetched` | Issue fetched from Jira |
| `issue.processed` | Issue processed with rule/action details |
| `status.changed` | Status transition detected |
| `status.unchanged` | No change (debug) |
| `action.createIssue` | New issue created |
| `action.syncStatus` | Status synced |
| `action.skipped` | Issue skipped with reason |
| `sync.cycle.completed` | Cycle summary with metrics |

### Files Modified

- `src/sync/audit-logger.ts` (new)
- `src/sync/sync-user-to-dev.ts`
- `src/sync/sync-dev-to-user.ts`
- `src/sync/monitor-all-projects.ts`
- `src/sync/issue-state-tracker.ts`
- `src/scheduler.ts`
- `AGENTS.md`
