- [x] **Core Fixes**
    - [x] Fix `src/config/index.ts` to load env vars correctly <!-- id: 1 -->
    - [x] Implement `src/jira/validator.ts` to check Auth, Projects, and Statuses <!-- id: 2 -->
    - [x] Update `src/sync/worker.ts` to use Validator before starting <!-- id: 3 -->

- [x] **Dynamic Status Logic**
    - [x] Update `src/jira/client.ts` to fetch/expose `statusCategory` <!-- id: 4 -->
    - [x] Refactor `sync-dev-to-user.ts` to use status category for resolution check <!-- id: 5 -->
    - [x] Refactor `status-change-actions.ts` to use status category <!-- id: 6 -->

- [x] **Verification**
    - [x] Run `test:auth` (should pass now) <!-- id: 7 -->
    - [x] Run `test:list-user-project` (should pass now) <!-- id: 8 -->
    - [x] Manual test of "Done" -> "Done" sync <!-- id: 9 -->
