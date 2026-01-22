# Event-Driven Status Change Sync

## Purpose

Implement a general, event-driven system for detecting and responding to status changes in Jira projects. This replaces the current approach of polling-based sync with predefined rules only.

## ADDED Requirements

### Requirement: Unified Issue State Tracking

The system MUST track the status of all issues in both User and Dev projects to detect status changes.

**Rationale:** To detect status changes, the system must know the previous status of each issue.

#### Scenario: Track Issue State

**Given** an issue with key "FHOCVX-123"
**When** the system fetches the issue and stores its status
**Then** the issue state is stored with: issueKey, projectType, status, updatedAt
**And** the state can be retrieved by issueKey

#### Scenario: Detect Status Change

**Given** an issue with previous status "To Do"
**When** the current status is "Resolved"
**Then** a status change is detected
**And** the change includes: issueKey, project, fromStatus, toStatus, timestamp

#### Scenario: Handle Unknown Previous Status

**Given** an issue with no previous state (new issue)
**When** the current status is fetched
**Then** the state is stored without detecting a change
**And** subsequent status changes are detected normally

### Requirement: Monitor Both Projects

The system MUST monitor both User and Dev projects for status changes.

**Rationale:** Bidirectional sync requires monitoring both projects.

#### Scenario: Monitor User Project

**Given** the User project key is "FHOCVX"
**When** the monitoring runs
**Then** issues in FHOCVX are fetched
**And** status changes are detected and stored

#### Scenario: Monitor Dev Project

**Given** the Dev project key is "DC5FC"
**When** the monitoring runs
**Then** issues in DC5FC are fetched
**And** status changes are detected and stored

#### Scenario: Return Detected Changes

**Given** multiple status changes in both projects
**When** monitoring completes
**Then** a list of changes is returned
**Each change contains:** issueKey, project, fromStatus, toStatus, timestamp

### Requirement: General Rule Matching

The system MUST match status changes against configuration rules using a general matching approach.

**Rationale:** Rules should match any status transition, not just predefined ones.

#### Scenario: Match Exact Status Transition

**Given** a rule with `sourceStatus: "Resolved"` and `syncDirection: "user_to_dev"`
**When** a User issue changes from "To Do" to "Resolved"
**Then** the rule is matched
**And** the target status is determined by `targetStatus` or `sourceStatus`

#### Scenario: Match with Wildcard

**Given** a rule with `sourceStatus: "*"` (catch-all for any status)
**When** an issue changes to a status with no specific rule
**Then** the catch-all rule is matched
**And** the default action is executed

#### Scenario: No Matching Rule

**Given** a status change with no matching rule
**When** rule matching completes
**Then** the change is logged as "unhandled"
**And** no action is taken (or configurable fallback)

### Requirement: Execute Actions for Status Changes

The system MUST execute configured actions when a status change matches a rule.

**Rationale:** Actions define what happens when a status change is detected.

#### Scenario: Sync Status Action

**Given** a rule with `actions.syncStatus: true` and `targetStatus: "Closed"`
**When** a User issue changes to "Resolved"
**Then** the Dev issue status is updated to "Closed"
**And** a log entry is created: "Synced User project -> Dev project"

#### Scenario: Create Issue Action

**Given** a rule with `actions.createIssue: true` and `requireMapping: false`
**When** a User issue changes to "Will Do" with no Dev mapping
**Then** a new Dev issue is created
**And** a mapping is established between the issues

#### Scenario: Add Comment Action

**Given** a rule with `actions.addComment: true` and `commentTemplate: "Synced from ${sourceKey}"`
**When** the rule is matched
**Then** a comment is added to the target issue
**And** `${sourceKey}` is replaced with the source issue key

### Requirement: Bidirectional Sync

The system MUST support status change detection and sync in both directions.

**Rationale:** Changes can flow from User to Dev and Dev to User.

#### Scenario: User to Dev Sync

**Given** a User issue changes status
**When** the change is detected and matches a `user_to_dev` rule
**Then** the configured action is executed on the Dev issue
**And** the Dev issue is updated accordingly

#### Scenario: Dev to User Sync

**Given** a Dev issue changes status
**When** the change is detected and matches a `dev_to_user` rule
**Then** the configured action is executed on the User issue
**And** the User issue is updated accordingly

#### Scenario: Bidirectional Direction

**Given** a rule with `syncDirection: "both"`
**When** a status change occurs in either project
**Then** the rule is matched regardless of source project
**And** the action is executed in the target project

### Requirement: Configurable Fallback Behavior

The system MUST have a configurable fallback behavior for unmatched status changes.

**Rationale:** Not all status changes need to be synced; some should be ignored.

#### Scenario: Ignore Unmatched Changes

**Given** a status change with no matching rule
**When** the fallback behavior is "ignore"
**Then** no action is taken
**And** a debug log is emitted: "No matching rule for status change"

#### Scenario: Default to Closed

**Given** a status change from User project with no matching rule
**When** the fallback behavior is "default_to_closed"
**Then** the Dev issue is set to "Closed" status
**And** a warning log is emitted

## Cross-Reference

- Related to `sync-flow-config` specification: Sync Rules Definition
- Related to `sync-flow-config` specification: Rule Actions
- Related to `sync-flow-config` specification: Sync Direction Control
