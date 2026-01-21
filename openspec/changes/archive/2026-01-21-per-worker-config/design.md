# Design: Per-Worker Configuration

## Overview

Move Jira credentials and sync interval from environment variables to per-worker config files.

## Current State

```
.env (global)
├── JIRA_BASE_URL=https://...
├── JIRA_EMAIL=...
├── JIRA_API_TOKEN=...
├── SYNC_INTERVAL_MINUTES=5
└── ... (shared by all workers)

config/sync-ab.json
├── userProjectKey: "USER-A"
├── devProjectKey: "DEV-A"
└── rules: [...]
```

## Proposed State

```
.env (global)
├── LOG_LEVEL=info
├── PORT=3000
└── DATABASE_URL=mongodb://...

config/sync-ab.json
├── name: "sync-ab"
├── jira:
│   ├── baseUrl: "https://company-a.atlassian.net"
│   ├── email: "bot-a@company.com"
│   ├── apiToken: "token-a"
│   └── authType: "pat"
├── userProjectKey: "USER-A"
├── devProjectKey: "DEV-A"
├── syncIntervalMinutes: 5
└── rules: [...]

config/sync-cd.json
├── name: "sync-cd"
├── jira:
│   ├── baseUrl: "https://company-b.atlassian.net"
│   ├── email: "bot-b@company.com"
│   ├── apiToken: "token-b"
│   └── authType: "pat"
├── userProjectKey: "USER-C"
├── devProjectKey: "DEV-C"
├── syncIntervalMinutes: 10
└── rules: [...]
```

## Benefits

1. **Isolation**: Each worker has its own credentials
2. **Flexibility**: Different Jira instances, different intervals
3. **Security**: No shared credentials across workers
4. **Simplicity**: All config in one place per worker

## Implementation Notes

### Config Type Update

```typescript
interface JiraConfig {
  baseUrl: string;
  email?: string;
  apiToken: string;
  authType: 'basic' | 'pat';
}

interface SyncConfig {
  name: string;
  jira: JiraConfig;
  userProjectKey: string;
  devProjectKey: string;
  syncIntervalMinutes: number;
  defaultBehavior: DefaultBehavior;
  rules: SyncRule[];
}
```

### Config Loader Update

- Parse `jira` object from config
- Parse `syncIntervalMinutes` from config
- Fallback to env vars if not in config (for backward compatibility)

### Worker Process Update

- Pass full config to worker process
- Worker uses `config.jira.*` instead of `process.env.JIRA_*`
- Worker uses `config.syncIntervalMinutes` instead of `process.env.SYNC_INTERVAL_MINUTES`
