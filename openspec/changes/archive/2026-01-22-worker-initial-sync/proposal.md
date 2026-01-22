# worker-initial-sync

## Summary

Implement initial sync behavior for new workers that:
1. Syncs all historical data on first run (when no `lastSync` timestamp exists)
2. Prevents re-running full sync on subsequent worker restarts
3. Uses incremental sync after initial sync is complete

## Problem Statement

### Current Behavior

When a worker starts:

1. **First run (no `lastSync`)**: 
   - Fetches ALL issues from Jira (no time filter)
   - Processes all issues based on rules
   - Sets `lastSync` timestamp after completion

2. **Subsequent runs**:
   - Fetches only updated issues since `lastSync`
   - Processes incrementally

3. **Problem: Restart without state**:
   - If worker restarts and `lastSync` is lost (fresh DB, new deployment)
   - System treats it as "first run" and fetches ALL issues again
   - This causes duplicate processing and potential issues

### Use Cases

| Scenario | Current Behavior | Desired Behavior |
|----------|------------------|------------------|
| Fresh worker deployment | Full sync all issues | Full sync all issues (once) |
| Worker restart with state | Incremental sync | Incremental sync |
| Worker restart without state (DB cleared) | Full sync all issues | **Warn + use recent timestamp, no full resync** |
| Worker upgrade/deploy | Full sync all issues | Track completion, skip full resync |

## Key Requirements

### 1. Track Initial Sync Completion

Add a flag to track whether initial sync has been completed for a worker:
- Store in database (new collection or existing `sync_state`)
- Set to `true` after first successful sync cycle
- Check before doing full sync on restart

### 2. Full Sync Only Once Per Worker

- Full sync (fetch all issues) happens only when:
  - No `lastSync` timestamp exists AND
  - Initial sync has NOT been completed
- After initial sync completes, set the completion flag

### 3. Smart Restart Handling

When worker restarts without `lastSync` but with completion flag:
- Log warning that state was lost
- Use current timestamp as `lastSync` (no full resync)
- Continue with incremental sync

### 4. Per-Worker State

Since multiple workers can run in same container:
- Use worker name in state tracking
- Each worker tracks its own sync state
- `sync_state` collection uses `name` field for identification

## Architecture Changes

### New State Tracking

Add `initial_sync_completed` field to `SyncStateDoc`:

```typescript
export type SyncStateDoc = {
  name: string;                    // worker name (e.g., "sync-ab")
  last_sync: Date;
  initial_sync_completed: boolean; // NEW: tracks if initial sync done
  created_at?: Date;
  updated_at?: Date;
};
```

### Config Changes

Add `initialSyncEnabled` field to `SyncFlowConfigDoc`:

```typescript
export type SyncFlowConfigDoc = {
  name: string;
  // ... existing fields
  initialSyncEnabled?: boolean; // NEW: control initial sync behavior
};
```

### Sync Flow Changes

```typescript
// In scheduler.ts
export const runSyncCycle = async (): Promise<void> => {
  const syncState = await getSyncState();
  const lastSync = syncState?.last_sync ?? null;
  const initialSyncDone = syncState?.initial_sync_completed ?? false;

  // Determine sync mode
  const doFullSync = !lastSync && !initialSyncDone;
  const effectiveLastSync = doFullSync ? null : lastSync;

  // Run sync with appropriate mode
  await syncUserProjectToDevProject(effectiveLastSync, syncConfig, doFullSync);
  await syncDevProjectToUserProject(effectiveLastSync, syncConfig, doFullSync);
  await monitorUserProjectStatuses();

  // Update state
  await updateLastSync(new Date());
  
  // Mark initial sync as completed
  if (doFullSync) {
    await markInitialSyncCompleted();
  }
};
```

### JQL Changes for Full vs Incremental

When `doFullSync` is true:
- Fetch all issues (current behavior when `lastSync` is null)
- Process all issues matching rules

When `doFullSync` is false:
- Use `lastSync` timestamp for incremental fetch
- Only process changed issues

## Scope

### In Scope
- Add `initial_sync_completed` field to `SyncStateDoc`
- Modify `getLastSync`/`updateLastSync` to handle new field
- Update `runSyncCycle` to check completion flag
- Add config option `initialSyncEnabled` to control behavior
- Update logging for initial sync events
- Update DEPLOY.md with new behavior documentation

### Out of Scope
- Changes to sync rules
- Changes to Jira API integration
- Changes to worker spawning logic
- Migration of existing data (new field defaults to `false`)

## Dependencies

- None - this change is self-contained
- Leverages existing `SyncStateModel` with new field

## Testing Strategy

1. **First run test**: Fresh DB, verify full sync happens
2. **Completion flag test**: After full sync, verify flag is set
3. **Restart test**: Restart worker, verify no full resync
4. **State loss test**: Clear DB state, restart, verify smart handling
5. **Config test**: Verify `initialSyncEnabled` flag works
6. **Multiple workers test**: Each worker tracks its own state

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing deployments fail | Low | New field optional, defaults to `false` |
| Initial sync never completes | High | Add timeout, manual override option |
| State corruption | Medium | Add validation, logging |

## Timeline

- **Proposal**: 1 day
- **Implementation**: 2-3 days
- **Testing**: 1 day
- **Documentation**: 0.5 day

**Total estimated: 4-5 days**
