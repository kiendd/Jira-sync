# Proposal: Per-Worker Configuration

**Change ID:** `per-worker-config`

## Why

Currently, some configuration parameters are set globally in `.env`:
- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `SYNC_INTERVAL_MINUTES`

This limits flexibility when workers need to sync different Jira instances with different credentials and sync frequencies.

## What Changes

### Move from .env to config/*.json

The following parameters SHALL be configured per-worker in config files:

| Parameter | Current Location | New Location | Reason |
|-----------|-----------------|--------------|--------|
| `JIRA_BASE_URL` | `.env` | `config/sync-*.json` | Different workers may sync different Jira instances |
| `JIRA_EMAIL` | `.env` | `config/sync-*.json` | Different credentials per instance |
| `JIRA_API_TOKEN` | `.env` | `config/sync-*.json` | Different tokens per instance |
| `SYNC_INTERVAL_MINUTES` | `.env` | `config/sync-*.json` | Different sync frequencies per worker |

### Config File Structure Update

Each `config/sync-*.json` SHALL include:

```json
{
  "name": "sync-ab",
  "jira": {
    "baseUrl": "https://company-a.atlassian.net",
    "email": "bot-a@company.com",
    "apiToken": "token-for-instance-a",
    "authType": "pat"
  },
  "userProjectKey": "USER-A",
  "devProjectKey": "DEV-A",
  "syncIntervalMinutes": 5,
  ...
}
```

### .env Simplification

The `.env` file SHALL only contain:
- `LOG_LEVEL`
- `PORT`
- `DATABASE_URL` (MongoDB connection)

## Requirements

### REQ-001: Per-Worker Jira Configuration

Each worker SHALL have its own Jira credentials in its config file.

### REQ-002: Per-Worker Sync Interval

Each worker SHALL have its own sync interval in its config file.

### REQ-003: Config Loader Support

The config loader SHALL parse Jira credentials and sync interval from config files.

### REQ-004: Environment Fallback

For backward compatibility, environment variables MAY be used as defaults.

## Validation

- Each config file contains all required Jira settings
- Workers use credentials from their config file
- No shared credentials across workers unless explicitly configured
