# initial-sync Specification

## Purpose
Track initial sync completion state to prevent unnecessary full resyncs when workers restart. Full sync (fetching all historical issues) should only happen once per worker, and subsequent restarts should use incremental sync.

## ADDED Requirements

### Requirement: Track Initial Sync Completion

The system MUST track whether initial full sync has been completed for each worker.

The system SHALL store completion status in the `sync_state` collection with the worker name.

The system SHALL use the `initial_sync_completed` boolean field to track completion.

#### Scenario: First Run - Full Sync

**Given** a worker starts for the first time
**And** no sync state exists for this worker
**When** the sync cycle runs
**Then** it performs a full sync (fetches all issues without time filter)
**And** it sets `initial_sync_completed` to `true` after completion

#### Scenario: Restart with Valid State

**Given** a worker restarts
**And** sync state exists with `last_sync` timestamp
**And** `initial_sync_completed` is `true`
**When** the sync cycle runs
**Then** it performs an incremental sync (fetches only updated issues)
**And** it does NOT perform a full sync

#### Scenario: Restart with Lost State but Completed

**Given** a worker restarts
**And** `initial_sync_completed` is `true` but `last_sync` is `null`
**When** the sync cycle runs
**Then** it logs a warning about lost sync state
**And** it performs an incremental sync using current time
**And** it does NOT perform a full sync

### Requirement: Full Sync Only Once

The system MUST NOT perform a full sync more than once per worker.

Full sync (fetching all issues without time filter) SHALL only occur when:
- No `last_sync` timestamp exists AND
- `initial_sync_completed` is `false` or undefined

After full sync completes, `initial_sync_completed` SHALL be set to `true`.

#### Scenario: Second Restart

**Given** a worker has completed initial sync (`initial_sync_completed = true`)
**When** the worker restarts multiple times
**Then** each restart performs only incremental sync
**And** no full sync is performed

#### Scenario: Force Full Sync via Config

**Given** a worker config has `initialSyncEnabled: true`
**And** initial sync has already completed
**When** an operator restarts the worker
**Then** incremental sync is still performed (config only affects first run)

### Requirement: Per-Worker State Isolation

The system MUST maintain separate sync state for each worker.

Each worker SHALL be identified by the `name` field in its configuration.

Sync state SHALL be isolated - restarting one worker does not affect other workers.

#### Scenario: Multiple Workers

**Given** workers `sync-ab` and `sync-cd` are running
**When** worker `sync-ab` restarts
**Then** worker `sync-ab` uses its own sync state
**And** worker `sync-cd` continues with its sync state unchanged

#### Scenario: Different Initial Sync Times

**Given** worker `sync-ab` starts first and completes initial sync
**When** worker `sync-cd` starts later
**Then** worker `sync-cd` performs its own full sync
**And** each worker's `initial_sync_completed` is tracked independently

### Requirement: Configuration Option

The system SHALL allow configuration of initial sync behavior via JSON config.

The `initialSyncEnabled` field in the worker config SHALL control whether initial sync is performed.

If `initialSyncEnabled` is `false`, the worker SHALL skip full sync entirely.

#### Scenario: Disable Initial Sync

**Given** a worker config has `initialSyncEnabled: false`
**When** the worker starts for the first time
**Then** it performs incremental sync using current time as `last_sync`
**And** it does NOT perform a full sync

#### Scenario: Default Behavior

**Given** a worker config does not specify `initialSyncEnabled`
**When** the worker starts
**Then** it defaults to `true` (perform initial full sync)

### Requirement: Logging and Monitoring

The system MUST log events related to initial sync for troubleshooting.

The system SHALL log at INFO level when starting initial sync.

The system SHALL log at INFO level when initial sync completes.

The system SHALL log at WARN level when sync state is lost but initial sync was completed.

#### Scenario: Initial Sync Started

**Given** a worker is performing initial sync
**When** the sync cycle begins
**Then** logs contain: `{"level": "info", "message": "Running initial full sync", "worker": "sync-ab"}`

#### Scenario: Initial Sync Completed

**Given** initial sync has finished
**When** the sync cycle completes
**Then** logs contain: `{"level": "info", "message": "Initial sync completed", "worker": "sync-ab"}`

#### Scenario: State Lost Warning

**Given** sync state was lost but initial sync was completed
**When** the worker starts
**Then** logs contain: `{"level": "warn", "message": "Last sync state lost, using current time for incremental sync", "worker": "sync-ab"}`

### Requirement: Data Model

The `sync_state` collection SHALL include the following fields per worker:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Worker identifier |
| last_sync | Date | Yes | Timestamp of last successful sync |
| initial_sync_completed | boolean | Yes | Whether initial full sync has been done |
| created_at | Date | No | When the record was created |
| updated_at | Date | No | When the record was last updated |

#### Scenario: New Worker Record

**Given** a new worker starts
**When** the first sync cycle runs
**Then** a new document is created in `sync_state` collection
**And** the document includes `name`, `last_sync`, and `initial_sync_completed: false`

#### Scenario: Update After Initial Sync

**Given** initial sync completes
**When** the worker updates sync state
**Then** `last_sync` is set to current timestamp
**And** `initial_sync_completed` is set to `true`
