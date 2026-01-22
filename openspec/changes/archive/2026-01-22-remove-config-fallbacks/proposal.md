# Remove Configuration Fallbacks

## Why

The current system has "fallback" behaviors that mask configuration errors. Specifically:
1. `src/scheduler.ts` falls back to a default configuration if a specific worker config isn't passed.
2. `src/sync/config-loader.ts` provides a hardcoded `defaultConfig` which often doesn't match the user's intention or the specific worker's environment.
3. This recently caused a bug where a worker silently used the default config (missing the "Resolved" rule) because the specific config wasn't propagated correctly.

Removing these fallbacks ensures the system fails fast and explicitly when configuration is missing or invalid, preventing "zombie" workers running with incorrect rules.

## What Changes

### 1. Enforce Explicit Configuration in Scheduler
- **File**: `src/scheduler.ts`
- **Change**: `runSyncCycle` and `startScheduler` will **REQUIRE** a `SyncFlowConfigDoc`. They will no longer fallback to `syncConfigLoader.loadConfig()`.

### 2. Remove Global Default Config
- **File**: `src/sync/config-loader.ts`
- **Change**: Remove `getDefaultConfig()` and the internal `defaultConfig` property. `loadConfig()` (singular) will be removed or changed to throw if no explicit config path/object is provided.

### 3. Strict Worker Startup
- **File**: `src/sync/worker.ts`
- **Change**: Ensure `workerConfig` is strictly validated and passed to `startScheduler`. (This is largely done but will be reinforced by the strict signature in scheduler).

### 4. Direct Dependency Injection
- **Files**: `src/sync/sync-user-to-dev.ts`, `src/sync/sync-dev-to-user.ts`
- **Change**: Verify these functions rely **solely** on the passed `syncConfig` argument for dynamic values (project keys, rules) and not on any global state or default loaders.
