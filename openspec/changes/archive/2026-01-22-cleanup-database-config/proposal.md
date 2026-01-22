# cleanup-database-config

## Summary

Clean up database configuration by removing redundant `DATABASE_NAME` loading from `config/index.ts`. The `DATABASE_URL` stays in environment variables (shared MongoDB instance), while `DATABASE_NAME` is already correctly derived per-worker from worker name.

## Problem Statement

### Current State

**src/config/index.ts** (redundant):
```typescript
export const config = {
  // ... JIRA config (loaded from JSON per worker)
  databaseUrl: optionalEnv('DATABASE_URL') || 'mongodb://localhost:27017',
  databaseName: optionalEnv('DATABASE_NAME') || 'jira_sync',  // REDUNDANT - not used by workers
  // ...
};
```

**src/sync/process-manager.ts** (actual per-worker logic):
```typescript
const env = {
  ...process.env,
  WORKER_NAME: cfg.name,
  WORKER_CONFIG_PATH: cfg.configPath,
  DATABASE_NAME: cfg.config.name || cfg.name,  // Per-worker DB name derived from worker name
};
```

**src/sync/worker.ts** (actual usage):
```typescript
const databaseName = process.env.DATABASE_NAME || workerName;  // Uses env from process-manager
```

### Issues

1. **Redundant Code**: `DATABASE_NAME` is loaded in `config/index.ts` but never used by workers
2. **Confusion**: `config.databaseName` exists but workers use `process.env.DATABASE_NAME`
3. **Dead Code**: The `databaseName` field in `config` object is unused
4. **Inconsistency**: `config.databaseUrl` is used (in db/index.ts), but `config.databaseName` is ignored

### Current Flow

```
docker-compose.yml
└── DATABASE_URL: mongodb://mongo:27017  ✓ Global (correct)
└── DATABASE_NAME: (not set)             

process-manager.ts
└── DATABASE_NAME: cfg.name → worker env  ✓ Per-worker (correct)

worker.ts
└── databaseName: process.env.DATABASE_NAME ✓ Uses process-manager value

config/index.ts
└── databaseName: from env (ignored)       ✗ REDUNDANT

db/index.ts
└── Uses: config.databaseUrl               ✓ Uses global config
```

## Solution

Remove `DATABASE_NAME` from `config/index.ts` since:
- `DATABASE_URL` stays global (environment variable)
- `DATABASE_NAME` is derived per-worker from worker name (already working)
- Workers get `DATABASE_NAME` via `process.env.DATABASE_NAME` set by `process-manager.ts`

### Architecture After Change

```
docker-compose.yml
└── DATABASE_URL: mongodb://mongo:27017  ✓ Global (unchanged)
└── (no DATABASE_NAME)                   ✓ Removed

process-manager.ts
└── DATABASE_NAME: cfg.name → worker env  ✓ Per-worker (unchanged)

worker.ts
└── databaseName: process.env.DATABASE_NAME ✓ Uses process-manager (unchanged)

config/index.ts
└── (no databaseName)                     ✓ Removed redundant loading

db/index.ts
└── Uses: config.databaseUrl               ✓ Unchanged
```

## Key Changes

### 1. Remove from src/config/index.ts

```typescript
// BEFORE
export const config = {
  jira: { /* from JSON per worker */ },
  databaseUrl: optionalEnv('DATABASE_URL') || 'mongodb://localhost:27017',
  databaseName: optionalEnv('DATABASE_NAME') || 'jira_sync',  // REMOVE
  logLevel: optionalEnv('LOG_LEVEL') || 'info',
  // ...
};

// AFTER
export const config = {
  jira: { /* from JSON per worker */ },
  databaseUrl: optionalEnv('DATABASE_URL') || 'mongodb://localhost:27017',
  logLevel: optionalEnv('LOG_LEVEL') || 'info',
  port: Number(optionalEnv('PORT') || 3000),
  configDir: optionalEnv('CONFIG_DIR') || './config',
};
```

### 2. Keep DATABASE_URL in docker-compose.yml

```yaml
environment:
  DATABASE_URL: mongodb://mongo:27017  ✓ Keep - global MongoDB instance
  LOG_LEVEL: ${LOG_LEVEL:-info}
  PORT: ${PORT:-3000}
  CONFIG_DIR: /app/config
```

### 3. Optional: Add databaseName to JSON Config (if override needed)

```json
{
  "name": "sync-ab",
  "databaseName": "custom_db_name",  // Optional: override default
  "jira": { ... },
  "userProjectKey": "USER-A",
  "devProjectKey": "DEV-A"
}
```

## Scope

### In Scope
- Remove `DATABASE_NAME` from `config/index.ts`
- Update `db/index.ts` to remove unused `config.databaseName`
- Verify `DATABASE_URL` still works correctly
- Update documentation

### Out of Scope
- Changes to `DATABASE_URL` handling (stays in env)
- Changes to worker spawning logic
- Changes to `process-manager.ts` (working correctly)
- Changes to `worker.ts` (working correctly)

## Dependencies

None - this is a simple cleanup change

## Testing Strategy

1. **Verify workers still start**: With `DATABASE_URL` in env
2. **Verify database names**: Each worker uses correct derived name
3. **Verify connection**: Workers connect to MongoDB successfully
4. **Verify no errors**: No reference to removed `config.databaseName`

## Example Usage

### docker-compose.yml

```yaml
environment:
  DATABASE_URL: mongodb://mongo:27017  # Global MongoDB
  LOG_LEVEL: info
  PORT: 3000
  CONFIG_DIR: /app/config
```

### JSON Config (config/sync-ab.json)

```json
{
  "name": "sync-ab",
  "jira": {
    "baseUrl": "https://company.atlassian.net",
    "email": "bot@company.com",
    "apiToken": "token",
    "authType": "pat"
  },
  "userProjectKey": "USER-A",
  "devProjectKey": "DEV-A",
  "syncIntervalMinutes": 5
}
```

Result:
- Worker connects to `mongodb://mongo:27017`
- Worker uses database `sync_ab` (derived from name)

## Timeline

- **Proposal**: 0.5 day
- **Implementation**: 0.5 day
- **Testing**: 0.5 day

**Total estimated: 1-1.5 days**
