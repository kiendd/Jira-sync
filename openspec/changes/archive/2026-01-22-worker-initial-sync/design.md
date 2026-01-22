# Design: worker-initial-sync

## Architectural Overview

This design adds state tracking for initial sync completion to prevent unnecessary full resyncs when workers restart.

### Current State (Problem)

```
Worker Start
    │
    ├─→ getLastSync() → null?
    │       │
    │       ├─→ YES: Fetch ALL issues (full sync)
    │       │       │
    │       │       └─→ Process all → updateLastSync()
    │       │
    │       └─→ NO: Fetch updated since lastSync (incremental)
    │
    └─→ Problem: If state lost, full sync runs again
```

### Target State (Solution)

```
Worker Start
    │
    ├─→ getSyncState() → { last_sync, initial_sync_completed }
    │       │
    │       ├─→ last_sync = null AND initial_sync_completed = false
    │       │       │
    │       │       └─→ FULL SYNC (first time only)
    │       │               │
    │       │               └─→ Process all → updateLastSync() + markCompleted()
    │       │
    │       ├─→ last_sync = null AND initial_sync_completed = true
    │       │       │
    │       │       └─→ WARNING: State lost, use current time
    │       │               │
    │       │               └─→ Incremental sync (no full resync)
    │       │
    │       └─→ last_sync != null
    │               │
    │               └─→ INCREMENTAL SYNC
```

## Detailed Design

### 1. Data Model Changes

#### SyncStateDoc Update

```typescript
// BEFORE
export type SyncStateDoc = {
  name: string;
  last_sync: Date;
};

// AFTER
export type SyncStateDoc = {
  name: string;
  last_sync: Date;
  initial_sync_completed: boolean;  // NEW
  created_at?: Date;
  updated_at?: Date;
};
```

#### SyncFlowConfigDoc Update

```typescript
export type SyncFlowConfigDoc = {
  name: string;
  // ... existing fields
  initialSyncEnabled?: boolean;  // NEW: override default behavior
};
```

### 2. Repository Changes

#### getSyncState (NEW)

```typescript
export const getSyncState = async (name: string): Promise<SyncStateDoc | null> => {
  return SyncStateModel.findOne({ name }).lean<SyncStateDoc | null>();
};
```

#### markInitialSyncCompleted (NEW)

```typescript
export const markInitialSyncCompleted = async (name: string): Promise<void> => {
  SyncStateModel.findOneAndUpdate(
    { name },
    { 
      $set: { 
        initial_sync_completed: true,
        updated_at: new Date()
      } 
    },
    { upsert: true }
  );
};
```

#### Update updateLastSync signature

```typescript
// Keep backward compatibility
export const updateLastSync = async (lastSync: Date, name = SYNC_STATE_NAME) =>
  SyncStateModel.findOneAndUpdate(
    { name },
    { $set: { last_sync: lastSync, updated_at: new Date() } },
    { upsert: true, new: true }
  );
```

### 3. Scheduler Changes

#### runSyncCycle Update

```typescript
export const runSyncCycle = async (): Promise<void> => {
  const syncConfig = syncConfigLoader.loadConfig();
  const workerName = syncConfig.name || 'default';
  
  const syncState = await getSyncState(workerName);
  const lastSync = syncState?.last_sync ?? null;
  const initialSyncDone = syncState?.initial_sync_completed ?? false;
  
  // Determine sync mode
  const doFullSync = !lastSync && !initialSyncDone;
  
  if (doFullSync) {
    logger.info({ worker: workerName }, 'Running initial full sync');
  } else if (!lastSync && initialSyncDone) {
    logger.warn({ worker: workerName }, 'Last sync state lost, using current time for incremental sync');
  }
  
  const effectiveLastSync = doFullSync ? null : (lastSync || new Date());
  
  await syncUserProjectToDevProject(effectiveLastSync, syncConfig, doFullSync);
  await syncDevProjectToUserProject(effectiveLastSync, syncConfig, doFullSync);
  await monitorUserProjectStatuses();
  
  // Update last sync timestamp
  await updateLastSync(new Date(), workerName);
  
  // Mark initial sync as completed
  if (doFullSync) {
    await markInitialSyncCompleted(workerName);
    logger.info({ worker: workerName }, 'Initial sync completed');
  }
};
```

### 4. Sync Function Signatures

Update sync functions to accept `doFullSync` parameter:

```typescript
// sync-user-to-dev.ts
export const syncUserProjectToDevProject = async (
  lastSync: Date | null,
  syncConfig: SyncFlowConfigDoc,
  doFullSync: boolean = false
): Promise<void> => {
  // If doFullSync is true, process all issues without time filter
  // If doFullSync is false, use lastSync for incremental fetch
  const issues = await getUpdatedUserProjectIssues(
    doFullSync ? null : lastSync,
    doFullSync  // NEW: bypass time filter if full sync
  );
  // ... rest of logic
};
```

### 5. JQL Query Changes

When `doFullSync` is true, JQL should not include time filter:

```typescript
// In jira/client.ts searchIssues
async searchIssues(params: {
  jql: string;
  fields?: string[];
  updatedSince?: Date | null;
  ignoreTimeFilter?: boolean;  // NEW
}): Promise<JiraIssue[]> {
  const { jql, updatedSince, ignoreTimeFilter } = params;
  
  let composedJql = jql;
  if (updatedSince && !ignoreTimeFilter) {
    // Add time filter
    const updatedClause = `updated >= "${formatJiraDate(updatedSince)}"`;
    // ... existing logic
  }
  // ... rest
}
```

### 6. Configuration Option

In JSON config file:

```json
{
  "name": "sync-ab",
  "initialSyncEnabled": true,
  "jira": { ... },
  "userProjectKey": "USER-A",
  "devProjectKey": "DEV-A"
}
```

Default behavior: `initialSyncEnabled = true` (do full sync on first run)

### 7. Logging and Monitoring

#### Initial Sync Start
```json
{
  "level": "info",
  "worker": "sync-ab",
  "message": "Running initial full sync"
}
```

#### Initial Sync Complete
```json
{
  "level": "info",
  "worker": "sync-ab",
  "message": "Initial sync completed"
}
```

#### State Lost Warning
```json
{
  "level": "warn",
  "worker": "sync-ab",
  "message": "Last sync state lost, using current time for incremental sync"
}
```

## Multi-Worker Considerations

Each worker tracks its own state using `name` field:

| Worker | Database | Sync State Name |
|--------|----------|-----------------|
| sync-ab | sync_ab | sync-ab |
| sync-cd | sync_cd | sync-cd |
| sync-xy | sync_xy | sync-xy |

State is isolated per worker - restarting one doesn't affect others.

## Trade-offs

### Why track completion in same collection?

- Single source of truth for worker state
- Uses existing `name` field for isolation
- Easy to query and manage

### Why not use separate collection?

- Additional complexity
- More connections/queries
- Over-engineering for this use case

### Why warn on state loss?

- Alerts operators to potential issues
- Prevents silent data loss
- Provides clear expectation: incremental sync only

## Backward Compatibility

1. **Existing deployments**: New field defaults to `false`
2. **First run after upgrade**: Will do full sync (correct behavior)
3. **After first sync**: Flag set to `true`, prevents resync

## Performance Impact

- **Minimal**: One additional query per sync cycle
- **Reduced load**: Prevents unnecessary full resyncs
- **Memory**: No significant change

## Security Considerations

- No new attack surface
- State tracking is read-heavy, write-once (after initial sync)
- Isolated per worker, no cross-worker access
