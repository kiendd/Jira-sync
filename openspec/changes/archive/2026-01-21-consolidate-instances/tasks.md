# Tasks: Consolidate Multiple Sync Instances

**Change ID:** `consolidate-instances`

**Total Estimate:** 2 days

## TASK-001: Design Multi-Config Architecture
- **Estimate:** 0.25 day
- **Status:** Done
- **Description:** Design how multiple configs are loaded and managed
- **Validation:** Architecture document in design.md
- **Dependencies:** None

## TASK-002: Update Config Loader for Multi-Config
- **Estimate:** 0.5 day
- **Status:** Done
- **Description:** Modify config loader to scan directory and load multiple configs
- **Validation:** Config loader reads all JSON files from config directory
- **Dependencies:** TASK-001

## TASK-003: Implement Child Process Manager
- **Estimate:** 0.75 day
- **Status:** Done
- **Description:** Create process manager to spawn and monitor child processes
- **Validation:** Each config spawns a worker process
- **Dependencies:** TASK-002

## TASK-004: Update Scheduler for Worker Processes
- **Estimate:** 0.25 day
- **Status:** Done
- **Description:** Modify scheduler to run in worker context with database isolation
- **Validation:** Each worker uses its own database connection
- **Dependencies:** TASK-003

## TASK-005: Create New Docker Compose
- **Estimate:** 0.25 day
- **Status:** Done
- **Description:** Create docker-compose.consolidated.yml with single container + MongoDB
- **Validation:** Compose file defines 1 sync container + 1 MongoDB
- **Dependencies:** TASK-004

## Dependency Graph

```
TASK-001 ──> TASK-002 ──> TASK-003 ──> TASK-004 ──> TASK-005
```

## Validation Commands

```bash
# Validate config loading
node -e "const loader = require('./dist/sync/config-loader.js'); console.log(loader.loadConfigs())"

# Test single container runs multiple pairs
docker-compose -f docker-compose.consolidated.yml up -d
docker ps | grep jira-sync

# Verify MongoDB has multiple databases
docker exec mongo-consolidated mongosh --eval "db.adminCommand('listDatabases')"
```

## File Structure

After implementation:

```
├── docker-compose.consolidated.yml  <- New file
├── .env.consolidated.example        <- New file
├── config/
│   ├── sync-rules.example.json
│   ├── sync-ab.json                 <- User creates
│   ├── sync-cd.json                 <- User creates
│   └── sync-xy.json                 <- User creates
└── src/
    └── sync/
        ├── config-loader.ts         <- Updated for multi-config
        ├── process-manager.ts       <- New file
        ├── worker.ts                <- New file
        └── index.ts                 <- New barrel export
```

## Implementation Summary

### Files Created
- `src/sync/process-manager.ts` - Child process manager with monitoring and restart logic
- `src/sync/worker.ts` - Worker entry point for forked processes
- `src/sync/index.ts` - Barrel export for sync module
- `docker-compose.consolidated.yml` - Single container + MongoDB compose file
- `.env.consolidated.example` - Environment template for consolidated deployment

### Files Modified
- `src/sync/config-loader.ts` - Added `loadConfigsFromDirectory()` and `SyncPairConfig` interface
- `src/config/index.ts` - Added `WORKER_DATABASE_NAME` support
- `src/index.ts` - Updated to use ProcessManager and start workers

### Key Features
- Multi-config directory scanning (reads all `sync-*.json` files)
- Child process spawning via `child_process.fork()`
- Worker health monitoring with heartbeat
- Automatic restart on worker crash
- Health check endpoint at `/health`
- Database isolation per worker via `WORKER_DATABASE_NAME`
