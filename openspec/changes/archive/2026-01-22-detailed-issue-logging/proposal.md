# Enhanced Issue Audit Logging

## Problem Statement

Current sync logging provides minimal information about processed issues, making it difficult for operators to:
- Verify which issues were processed in a sync cycle
- Understand what actions were taken on each issue
- Trace status changes and their outcomes
- Debug sync issues effectively

Existing logs only capture high-level events without issue-specific details like title, status transitions, or action results.

## Root Cause Analysis

### Current Logging Gaps

1. **Missing issue title**: Logs only show issue keys, not summaries/titles
2. **Incomplete status tracking**: Status transitions are logged but not consistently across all sync paths
3. **Action ambiguity**: Log messages don't specify what action was taken (create, update, skip, etc.)
4. **No audit trail**: Cannot reconstruct what happened during a sync cycle
5. **Inconsistent logging**: Different sync paths (user→dev, dev→user, status changes) log at different levels

### Current Behavior Example

```
[sync-snx] [16:34:46.361] INFO: Fetched User project issues (count: 0)
[sync-snx] [16:35:00.814] INFO: Fetched Jira issues (count: 0)
[sync-snx] [16:35:01.322] INFO: Status monitoring completed (userChanges: 0, devChanges: 0, total: 0)
```

When issues are processed:
```
[sync-snx] [16:35:01.322] INFO: Synced Dev project -> User project
  { devIssue: "DC5SNX-123", userIssue: "FSNX-456", status: "Resolved" }
```

Missing: issue title, from→to status, rule ID, action details.

## Proposed Solution

Implement structured audit logging for all issue processing:

1. **Issue Processing Log**: Log every issue processed with key, title, current status
2. **Status Change Log**: Log status transitions (from→to) with timestamps
3. **Action Result Log**: Log action taken (create/sync/skip) with outcome
4. **Sync Cycle Summary**: Log summary statistics at cycle end

### New Log Structure

```json
{
  "level": "info",
  "event": "issue.processed",
  "issueKey": "FSNX-123",
  "issueTitle": "Login button not working",
  "projectType": "user",
  "currentStatus": "Will Do",
  "ruleId": "user-will-do",
  "action": "createIssue",
  "targetKey": "DC5SNX-456",
  "timestamp": "2026-01-22T17:00:00.000Z"
}

{
  "level": "info",
  "event": "status.changed",
  "issueKey": "FSNX-123",
  "projectType": "user",
  "fromStatus": "Open",
  "toStatus": "Will Do",
  "ruleId": "user-will-do",
  "timestamp": "2026-01-22T17:00:00.000Z"
}

{
  "level": "info",
  "event": "sync.cycle.completed",
  "worker": "sync-snx",
  "duration": 1500,
  "issuesProcessed": 10,
  "statusChanges": 3,
  "issuesCreated": 2,
  "statusSynced": 1,
  "skipped": 5,
  "errors": 0,
  "timestamp": "2026-01-22T17:00:01.500Z"
}
```

## Implementation Approach

### Phase 1: Add Issue Details to Existing Logs

- Include issue title/summary in all issue-related logs
- Add `fromStatus` and `toStatus` for status change logs
- Include rule ID for traceable sync decisions

### Phase 2: Add Audit Events

- `issue.fetched`: When an issue is fetched from Jira
- `issue.processed`: When an issue is processed by sync logic
- `status.detected`: When a status change is detected
- `action.executed`: When a sync action is executed
- `action.skipped`: When an issue is skipped with reason

### Phase 3: Sync Cycle Summary

- Log comprehensive summary at end of each sync cycle
- Include duration, counts, and error summary
- Enable operators to quickly assess sync health
