# Tasks: Per-Worker Configuration

**Change ID:** `per-worker-config`

**Total Estimate:** 0.5 day

## TASK-001: Update Config Schema
- **Estimate:** 0.1 day
- **Status:** Completed
- **Description:** Add jira credentials and sync interval to config schema
- **Validation:** Config type includes new fields
- **Dependencies:** None

## TASK-002: Update Config Loader
- **Estimate:** 0.1 day
- **Status:** Completed
- **Description:** Modify config loader to parse new fields
- **Validation:** Config loader extracts jira settings and sync interval
- **Dependencies:** TASK-001

## TASK-003: Update Worker Process
- **Estimate:** 0.1 day
- **Status:** Completed
- **Description:** Modify worker to use config file settings
- **Validation:** Worker uses jira settings from config
- **Dependencies:** TASK-002

## TASK-004: Update Example Config
- **Estimate:** 0.05 day
- **Status:** Completed
- **Description:** Update sync-rules.example.json with new fields
- **Validation:** Example config includes jira credentials
- **Dependencies:** TASK-001

## TASK-005: Update .env.example
- **Estimate:** 0.05 day
- **Status:** Completed
- **Description:** Simplify .env.example, remove per-worker settings
- **Validation:** .env.example only contains global settings
- **Dependencies:** None

## TASK-006: Validate Implementation
- **Estimate:** 0.1 day
- **Status:** Completed
- **Description:** Run lint and verify changes
- **Validation:** All checks pass
- **Dependencies:** TASK-005

## Dependency Graph

```
TASK-001 ──> TASK-002 ──> TASK-003 ──> TASK-006
      │                     │
      └──> TASK-004 ────────┘
TASK-005 ─────────────────> TASK-006
```

## Validation Commands

```bash
# Validate config loading
node -e "const loader = require('./dist/sync/config-loader.js'); const configs = loader.loadConfigs(); console.log(configs[0].config.jira)"

# Verify .env simplified
grep -E "JIRA_|SYNC_INTERVAL" .env.example || echo "No per-worker settings in .env"

# Run lint
npm run lint
```

## File Structure

After implementation:

```
.env.example              <- Simplified (no JIRA_*, SYNC_INTERVAL)
config/
  sync-rules.example.json <- Updated with jira credentials
  sync-ab.json            <- User creates with full config
  sync-cd.json            <- User creates with full config
src/
  sync/
    config-loader.ts      <- Updated to parse new fields
```

## Example Config After Changes

```json
{
  "name": "sync-ab",
  "jira": {
    "baseUrl": "https://company-a.atlassian.net",
    "email": "bot-a@company.com",
    "apiToken": "token-here",
    "authType": "pat"
  },
  "userProjectKey": "USER-A",
  "devProjectKey": "DEV-A",
  "syncIntervalMinutes": 5,
  "defaultBehavior": { ... },
  "rules": [ ... ]
}
```
