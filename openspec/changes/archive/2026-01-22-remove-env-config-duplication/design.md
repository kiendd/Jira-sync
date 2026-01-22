# Design: remove-env-config-duplication

## Architectural Overview

This design removes all JIRA environment variables from the application. JSON config files become the **only** source of truth for JIRA configuration. This enables running multiple workers with different JIRA instances simultaneously.

### Current State (Problem)

```
┌─────────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ environment:                                            │   │
│  │   JIRA_BASE_URL: ${JIRA_BASE_URL}       ← DUPLICATED   │   │
│  │   JIRA_API_TOKEN: ${JIRA_API_TOKEN}     ← DUPLICATED   │   │
│  │   JIRA_EMAIL: ${JIRA_EMAIL}             ← DUPLICATED   │   │
│  │   USER_PROJECT_KEY: ${USER_PROJECT_KEY} ← DUPLICATED   │   │
│  │   DEV_PROJECT_KEY: ${DEV_PROJECT_KEY}   ← DUPLICATED   │   │
│  │   CONFIG_DIR: /app/config              ← USED          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    src/config/index.ts                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ requireEnv('JIRA_BASE_URL')    ← CRASHES if missing     │   │
│  │ requireEnv('JIRA_API_TOKEN')   ← CRASHES if missing     │   │
│  │ requireEnv('USER_PROJECT_KEY') ← CRASHES if missing     │   │
│  │ requireEnv('DEV_PROJECT_KEY')  ← CRASHES if missing     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Global config object created with env vars               │   │
│  │ Used by main process before workers spawn                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    src/sync/worker.ts                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ loadWorkerConfig() reads from JSON file                 │   │
│  │ applyConfigToGlobal() OVERRIDES global config           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Problem

1. The main process **requires** JIRA env vars at startup
2. Workers immediately **override** these values from JSON config files
3. Env vars are redundant for multi-worker deployments
4. Cannot run workers with different JIRA instances (single env var set)

### Target State (Solution)

```
┌─────────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ environment:                                            │   │
│  │   DATABASE_URL: mongodb://mongo:27017    ← KEEP        │   │
│  │   SYNC_INTERVAL_MINUTES: ${SYNC_INTERVAL_MINUTES}       │   │
│  │   LOG_LEVEL: ${LOG_LEVEL}                 ← KEEP       │   │
│  │   PORT: ${PORT}                           ← KEEP       │   │
│  │   CONFIG_DIR: /app/config                 ← KEEP       │   │
│  │   # NO JIRA_* variables                   ← REMOVED    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    src/config/index.ts                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ # No JIRA env vars loaded                               │   │
│  │ # Only non-JIRA config: LOG_LEVEL, PORT, etc.          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    src/sync/config-loader.ts                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ loadConfigsFromDirectory()                              │   │
│  │   ↓                                                     │   │
│  │ Load all config/sync-*.json files                       │   │
│  │   ↓                                                     │   │
│  │ Each worker gets its own JIRA credentials               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐
         │Worker AB│    │Worker CD│    │Worker XY│
         │Jira A   │    │Jira B   │    │Jira C   │
         └─────────┘    └─────────┘    └─────────┘
```

## Detailed Design

### 1. Config Loading Flow

```
Startup
  │
  └─→ Check if CONFIG_DIR exists and has valid *.json files
          │
          ├─→ YES: Load all configs, spawn workers
          └─→ NO: FAIL with clear error message
                  │
                  "ERROR: No config files found in ./config/
                   Please create at least one sync-*.json file.
                   See DEPLOY.md for configuration guide."
```

### 2. Changes to src/config/index.ts

**REMOVE:**
- `requireEnv('JIRA_BASE_URL')`
- `requireEnv('JIRA_API_TOKEN')`
- `requireEnv('JIRA_EMAIL')`
- `requireEnv('USER_PROJECT_KEY')`
- `requireEnv('DEV_PROJECT_KEY')`
- `requireEnv('DATABASE_URL')` (keep, used by MongoDB connection)
- JIRA-related config export

**KEEP:**
- `LOG_LEVEL`
- `PORT`
- `SYNC_INTERVAL_MINUTES`
- `DATABASE_URL` (for MongoDB connection string)
- `DATABASE_NAME`

```typescript
// BEFORE
export const config = {
  jira: {
    baseUrl: normalizeBaseUrl(requireEnv('JIRA_BASE_URL')),
    email: jiraAuthType === 'basic' ? requireEnv('JIRA_EMAIL') : optionalEnv('JIRA_EMAIL') || '',
    apiToken: requireEnv('JIRA_API_TOKEN'),
    authType: jiraAuthType,
    userProjectKey: requireEnv('USER_PROJECT_KEY'),
    devProjectKey: requireEnv('DEV_PROJECT_KEY'),
  },
  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES || 5),
  databaseUrl: requireEnv('DATABASE_URL'),
  databaseName: optionalEnv('WORKER_DATABASE_NAME') || requireEnv('DATABASE_NAME'),
};

// AFTER - No JIRA config, only infrastructure config
export const config = {
  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES || 5),
  databaseUrl: optionalEnv('DATABASE_URL') || 'mongodb://localhost:27017',
  databaseName: optionalEnv('DATABASE_NAME') || 'jira_sync',
  logLevel: optionalEnv('LOG_LEVEL') || 'info',
  port: Number(optionalEnv('PORT') || 3000),
  configDir: optionalEnv('CONFIG_DIR') || './config',
};
```

### 3. Changes to docker-compose.yml

```yaml
# BEFORE
environment:
  JIRA_AUTH_TYPE: ${JIRA_AUTH_TYPE:-pat}
  JIRA_BASE_URL: ${JIRA_BASE_URL}
  JIRA_EMAIL: ${JIRA_EMAIL:-}
  JIRA_API_TOKEN: ${JIRA_API_TOKEN}
  USER_PROJECT_KEY: ${USER_PROJECT_KEY}
  DEV_PROJECT_KEY: ${DEV_PROJECT_KEY}
  DATABASE_URL: mongodb://mongo:27017
  SYNC_INTERVAL_MINUTES: ${SYNC_INTERVAL_MINUTES:-5}
  LOG_LEVEL: ${LOG_LEVEL:-info}
  PORT: ${PORT:-3000}
  CONFIG_DIR: /app/config

# AFTER - No JIRA variables
environment:
  DATABASE_URL: mongodb://mongo:27017
  SYNC_INTERVAL_MINUTES: ${SYNC_INTERVAL_MINUTES:-5}
  LOG_LEVEL: ${LOG_LEVEL:-info}
  PORT: ${PORT:-3000}
  CONFIG_DIR: /app/config
```

### 4. Changes to src/sync/config-loader.ts

**REMOVE:**
- `applyEnvFallback()` function
- `getDefaultConfig()` JIRA defaults from env vars
- `optionalEnv()` calls for JIRA variables

**SIMPLIFY:**
- `getDefaultConfig()` returns empty structure or minimal defaults
- `loadConfigFromFile()` purely file-based

### 5. Changes to src/sync/worker.ts

**REMOVE:**
- Env var usage (already handled by config loader)

**KEEP:**
- `loadWorkerConfig()` from JSON file
- `applyConfigToGlobal()` to set worker-specific config

### 6. Worker Spawn Flow

```typescript
// Main process
const configs = syncConfigLoader.loadConfigs();  // From JSON files

if (configs.length === 0) {
  // FAIL - no configs found
  logger.error('No config files found in ./config/');
  process.exit(1);
}

for (const cfg of configs) {
  spawnWorker({
    WORKER_NAME: cfg.name,
    WORKER_CONFIG_PATH: cfg.configPath,
    DATABASE_NAME: `${cfg.name}_sync`,
  });
}
```

### 7. Error Messages

When no config files are found:

```
ERROR: No configuration files found in /app/config/
       
To run the service, you must create at least one JSON config file.
       
Example config/sync-ab.json:
{
  "name": "sync-ab",
  "jira": {
    "baseUrl": "https://your-domain.atlassian.net",
    "email": "bot@your-domain.com",
    "apiToken": "your-api-token",
    "authType": "pat"
  },
  "userProjectKey": "USER-A",
  "devProjectKey": "DEV-A",
  "syncIntervalMinutes": 5
}
       
See DEPLOY.md for detailed configuration instructions.
```

When a config file is invalid:

```
ERROR: Invalid configuration file: config/sync-ab.json
       
Parse error: Unexpected token '}' at position 100
       
Please fix the JSON syntax and restart the service.
```

## Multi-JIRA Worker Example

Running workers with different Jira instances:

```bash
# config/jira-prod.json
{
  "name": "sync-prod",
  "jira": {
    "baseUrl": "https://company.atlassian.net",
    "email": "bot-prod@company.com",
    "apiToken": "prod-token",
    "authType": "pat"
  },
  "userProjectKey": "USER-PROD",
  "devProjectKey": "DEV-PROD",
  "syncIntervalMinutes": 5
}

# config/jira-customer.json
{
  "name": "sync-customer",
  "jira": {
    "baseUrl": "https://customer.atlassian.net",
    "email": "bot@customer.com",
    "apiToken": "customer-token",
    "authType": "pat"
  },
  "userProjectKey": "CUST-SUPPORT",
  "devProjectKey": "CUST-DEV",
  "syncIntervalMinutes": 10
}
```

Result:
- Worker `sync-prod` connects to company Jira
- Worker `sync-customer` connects to customer Jira
- Both run in same container, different databases

## Trade-offs

### Why No Fallback?

1. **Multiple JIRA Instances**: Fallback to env vars would only support single JIRA instance
2. **Simplicity**: No dual code paths to maintain
3. **Clarity**: Single source of truth eliminates confusion
4. **Enforcement**: Forces proper configuration management

### Why Not Keep Fallback for Migration?

- Migration is one-time effort
- Fallback code adds complexity forever
- Multi-worker use case is primary driver for this change

## Security Considerations

- **Reduced Attack Surface**: No JIRA credentials in environment
- **Read-only Config**: Mount JSON files as read-only volume in Docker
- **No Secrets in Env**: Credentials stay in config files (can use secrets management)
- **Clear Separation**: Infrastructure config (env) vs Business config (file)

## Performance Impact

- **Minimal**: File I/O for config loading at startup only
- **No Runtime Impact**: Config is loaded once, cached in memory
- **Worker Startup**: Each worker reads its own config file once

## Validation Strategy

1. **Startup Validation**: Check config directory exists and has files
2. **JSON Parsing**: Validate JSON syntax before spawning workers
3. **Required Fields**: Check `name`, `jira.baseUrl`, `jira.apiToken`, `userProjectKey`, `devProjectKey`
4. **Worker Health**: Each worker validates config before starting scheduler
