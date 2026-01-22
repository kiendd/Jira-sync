# Issue Audit Logging Specification

## Purpose

Define structured audit logging requirements for issue sync operations to provide operators with detailed visibility into processed issues, status changes, and action outcomes.

## ADDED Requirements

### Requirement: Issue Processing Log

The system MUST log detailed information for every issue processed during sync operations.

**Rationale:** Operators need to verify which issues were processed and what actions were taken.

#### Scenario: Log Fetched Issues

**Given** an issue is fetched from Jira during sync
**When** the issue is processed
**Then** a log entry MUST be created with:
- `event`: "issue.fetched"
- `issueKey`: The issue key (e.g., "FSNX-123")
- `issueTitle`: The issue summary/title
- `projectType`: "user" or "dev"
- `currentStatus`: The current status name
- `updatedAt`: The issue's last updated timestamp

#### Scenario: Log Issue Processing Result

**Given** an issue is processed by sync logic
**When** a matching rule is found and action is taken
**Then** a log entry MUST be created with:
- `event`: "issue.processed"
- `issueKey`: The issue key
- `issueTitle`: The issue summary/title
- `projectType`: "user" or "dev"
- `currentStatus`: The current status name
- `ruleId`: The ID of the matched rule
- `action`: One of "createIssue", "syncStatus", "skip", "noRule"
- `targetKey`: The target issue key (if mapping exists/created)
- `mappingExists`: Boolean indicating if mapping existed

### Requirement: Status Change Log

The system MUST log all detected status changes with full transition details.

**Rationale:** Status changes are critical for tracking issue lifecycle and debugging sync issues.

#### Scenario: Log Status Transition

**Given** a status change is detected for an issue
**When** the change is processed
**Then** a log entry MUST be created with:
- `event`: "status.changed"
- `issueKey`: The issue key
- `projectType`: "user" or "dev"
- `fromStatus`: The previous status name (or null for new issues)
- `toStatus`: The new status name
- `isNewIssue`: Boolean indicating if this is a new issue
- `timestamp`: ISO 8601 timestamp of detection

#### Scenario: Log Status Without Change

**Given** an issue is processed but no status change is detected
**When** the issue is checked
**Then** a debug log entry SHOULD be created with:
- `event`: "status.unchanged"
- `issueKey`: The issue key
- `projectType`: "user" or "dev"
- `currentStatus`: The current status name

### Requirement: Action Execution Log

The system MUST log the result of each sync action with sufficient detail for auditing.

**Rationale:** Operators need to verify that actions (create, sync, comment) were executed correctly.

#### Scenario: Log Issue Creation

**Given** a rule triggers issue creation
**When** the target issue is created successfully
**Then** a log entry MUST be created with:
- `event`: "action.createIssue"
- `sourceKey`: The source issue key
- `sourceTitle`: The source issue title
- `sourceProject`: "user" or "dev"
- `targetKey`: The created target issue key
- `targetProject`: The opposite project
- `status`: The status of the created issue

#### Scenario: Log Status Sync

**Given** a rule triggers status synchronization
**When** the target issue status is updated
**Then** a log entry MUST be created with:
- `event`: "action.syncStatus"
- `sourceKey`: The source issue key
- `sourceStatus`: The source status
- `targetKey`: The target issue key
- `targetStatus`: The target status applied
- `direction`: "user_to_dev" or "dev_to_user"

#### Scenario: Log Skipped Issues

**Given** an issue is skipped during processing
**When** the skip occurs
**Then** a log entry MUST be created with:
- `event`: "action.skipped"
- `issueKey`: The issue key
- `reason`: One of "noRule", "requireMapping", "hasLink", "noChange"
- `details`: Additional context about the skip

### Requirement: Sync Cycle Summary

The system MUST log a comprehensive summary at the end of each sync cycle.

**Rationale:** Operators need a quick overview of sync cycle health and results.

#### Scenario: Log Cycle Summary

**Given** a sync cycle completes
**When** all issues are processed
**Then** a log entry MUST be created with:
- `event`: "sync.cycle.completed"
- `worker`: The worker name (e.g., "sync-snx")
- `durationMs`: Time spent in milliseconds
- `issuesFetched`: Total issues fetched from both projects
- `statusChangesDetected`: Number of status changes found
- `issuesCreated`: Number of new issues created
- `statusesSynced`: Number of status synchronizations performed
- `issuesSkipped`: Number of issues skipped
- `errors`: Number of errors encountered

#### Scenario: Log Cycle Errors

**Given** errors occur during sync cycle
**When** the cycle completes with errors
**Then** the summary MUST include:
- `errorCount`: Total number of errors
- `errorTypes`: Categorized error counts
- `firstError`: The first error message encountered

## Cross-Reference

- Related to `sync-flow-config` specification: Rule Actions
- Related to `sync-resolved-status` specification: Status Change Detection
