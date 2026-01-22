# sync-resolved-status

## Problem Statement

The current approach of adding individual rules for each status is not scalable. User configured sync for "Resolved" status, but it didn't work because there was no rule to handle it.

## Root Cause Analysis

### Current Architecture Issues

1. **Rule-based only**: System only syncs when a specific rule exists for a status
2. **Missing rules gap**: When a status change occurs without a matching rule, it's silently ignored
3. **Single-direction monitoring**: Only User project is monitored for status changes (`monitorUserProjectStatuses`)
4. **No general status change detection**: System doesn't have a general mechanism to detect and react to any status change

### Current Implementation

```
Cron Job → fetchIssues(lastSync) → findMatchingRule() → if (!rule) continue;
```

When a User issue changes to "Resolved" but no rule exists, the issue is silently skipped.

## Proposed Solution: Event-Driven Status Change Detection

Instead of adding individual rules, implement a general status change detection system:

1. **Monitor both projects** for status changes (User and Dev)
2. **Detect status changes** by comparing current status with previous stored status
3. **Evaluate configuration** to determine appropriate action for any status transition
4. **Take action** based on configured rules

### New Architecture

```
Cron Job → fetchAllIssues() → detectStatusChanges() → evaluateRules() → executeActions()
```

### Key Components

1. **Status Change Detector**: Detects any status change in both projects
2. **Rule Evaluator**: Matches status changes against configuration
3. **Action Executor**: Performs configured actions (sync status, create issue, etc.)

### Benefits

- **Scalable**: Handles any status, not just predefined ones
- **General**: Works for any status transition
- **Configurable**: Rules define behavior for status changes
- **Reactive**: Responds to changes, not just polling

## Implementation Approach

### Phase 1: Extend Status Monitoring

- Monitor both User and Dev projects for status changes
- Store previous status for all issues (not just User project)
- Detect any status change (from → to)

### Phase 2: General Rule Evaluation

- Match status changes against configuration rules
- Support wildcard or catch-all rules for undefined statuses
- Fallback behavior for unmatched statuses

### Phase 3: Action Execution

- Execute configured actions for matched rules
- Support all existing actions: syncStatus, createIssue, addComment, etc.
- Log all actions for debugging
