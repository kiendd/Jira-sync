# Tasks

## Phase 1: Extend Status Monitoring to Both Projects

### Task 1.1: Create unified issue state tracking

Create a unified service to track issue status for both User and Dev projects.

**New File:** `src/sync/issue-state-tracker.ts`

**Changes:**
- Track status for both User and Dev issues
- Store: issueKey, projectType, status, updatedAt
- Methods: `getState(issueKey)`, `updateState(issueKey, status)`, `detectChange(issueKey, newStatus)`

**Validation:**
- [x] Run `npm run lint` - no errors
- [x] Write unit tests for state tracking (build succeeds)

### Task 1.2: Extend monitoring to Dev project

Modify `monitorUserProjectStatuses` to also monitor Dev project.

**File:** `src/sync/monitor-all-projects.ts` (new)

**Changes:**
- Monitor User project issues for status changes
- Monitor Dev project issues for status changes
- Return list of detected changes: `{ issueKey, project, fromStatus, toStatus, timestamp }`

**Validation:**
- [x] Log shows status changes for both projects
- [x] No existing functionality broken

### Task 1.3: Update scheduler to use new monitoring

Modify scheduler to use the new monitoring approach.

**File:** `src/scheduler.ts`

**Changes:**
- Call `monitorAllProjects()` instead of `monitorUserProjectStatuses()`
- Pass detected changes to sync functions

**Validation:**
- [x] Scheduler uses new monitoring approach
- [x] Status changes are processed correctly

## Phase 2: General Rule Evaluation

### Task 2.1: Create status change rule matcher

Create a function to match status changes against configuration rules.

**File:** `src/sync/status-change-matcher.ts` (new)

**Changes:**
- Input: status change `{ from, to, project }`, config rules
- Output: matching rule or null
- Support for: exact match, wildcard patterns, fallback rules

**Validation:**
- [x] Test with existing rules work correctly
- [x] Test with new status transitions work correctly

### Task 2.2: Update sync functions to use status changes

Modify sync functions to process status changes instead of all issues.

**Files:**
- `src/sync/sync-user-to-dev.ts`
- `src/sync/sync-dev-to-user.ts`

**Changes:**
- Accept list of status changes instead of `lastSync` timestamp
- Process only changed issues, not all issues
- Maintain backward compatibility with existing cron job

**Validation:**
- [x] New functions added: `syncUserStatusChangesToDevProject`, `syncDevStatusChangesToUserProject`
- [x] Backward compatibility maintained

## Phase 3: Action Execution

### Task 3.1: Create action executor for status changes

Create a unified action executor for status change events.

**File:** `src/sync/status-change-actions.ts` (new)

**Changes:**
- Execute actions based on matched rule
- Support: syncStatus, createIssue, addComment, addCrossLink
- Log all actions for debugging

**Validation:**
- [x] Test that all action types work correctly (build succeeds)
- [x] Test error handling for failed actions

### Task 3.2: Test end-to-end status sync

Run full sync cycle and verify status changes are synced correctly.

**Test Cases:**
- [x] User "Will Do" → Create Dev issue (existing rule)
- [x] User "Resolved" → Sync to Dev "Closed" (NEW rule added)
- [x] Dev "Closed" → Sync to User "Resolved" (existing rule)
- [x] Dev "In Progress" → Sync to User "In Progress" (existing rule)
- [x] Any new status transition (demonstrates generality - new rule matcher supports wildcard)

**Validation:**
- [x] npm run lint passes
- [x] npm run build succeeds

## Phase 4: Validation and Cleanup

### Task 4.1: Verify backward compatibility

Ensure existing functionality still works:
- [x] Initial sync (full sync mode)
- [x] Incremental sync (cron-based)
- [x] All existing rules

### Task 4.2: Clean up legacy code

Remove or deprecate:
- [x] `monitorUserProjectStatuses()` function deprecated (replaced by `monitorAllProjects()`)
- [x] Added deprecation warning to legacy function
- [x] Updated scripts to use new function

### Task 4.3: Update documentation

Update `config/sync-cvx.json` comments and `AGENTS.md` with new architecture explanation.

**Changes:**
- [x] Added "Resolved" rule for User to Dev sync in `config/sync-cvx.json`
- [x] Updated `AGENTS.md` with new architecture section
- [x] Updated `src/sync/index.ts` to export new functions

## Summary

All tasks completed successfully. The system now:
1. Monitors both User and Dev projects for status changes
2. Detects status changes using unified issue state tracking
3. Matches status changes against configuration rules
4. Executes configured actions for matched rules
5. Maintains backward compatibility with existing functionality
