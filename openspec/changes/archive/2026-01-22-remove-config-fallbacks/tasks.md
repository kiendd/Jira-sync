# Tasks

- [x] **Refactor Scheduler**
    - [x] Update `src/scheduler.ts` to make `config` argument required in `runSyncCycle` <!-- id: 1 -->
    - [x] Update `src/scheduler.ts` to make `workerConfig` required in `startScheduler` <!-- id: 2 -->

- [x] **Cleanup Config Loader**
    - [x] Remove `getDefaultConfig` and default fallback logic in `src/sync/config-loader.ts` <!-- id: 3 -->
    - [x] Remove `loadConfig()` (singular implicit load) from `SyncConfigLoader` <!-- id: 4 -->

- [x] **Verification**
    - [x] Verify `npm run build` passes (ensures all callers provide config) <!-- id: 5 -->
    - [x] Verify `npm start` works with valid config <!-- id: 6 -->
