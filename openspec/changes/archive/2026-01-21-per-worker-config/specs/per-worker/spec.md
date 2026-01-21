# Spec: Per-Worker Configuration

## ADDED Requirements

### Requirement: Per-Worker Jira Credentials

Each worker SHALL have its own Jira credentials in its config file.

**Rationale:** Enable workers to sync different Jira instances with different credentials.

#### Scenario: Worker has own Jira config

**Given** a config file `config/sync-ab.json`
**When** the worker starts
**Then** it SHALL read Jira settings from `config.jira`
**And** `config.jira.baseUrl` SHALL be used as Jira base URL
**And** `config.jira.apiToken` SHALL be used for authentication
**And** `config.jira.email` SHALL be used when `authType` is "basic"

#### Scenario: Different workers, different Jira instances

**Given** two config files: `sync-ab.json` and `sync-cd.json`
**When** workers start
**Then** worker AB SHALL connect to Jira at `sync-ab.jira.baseUrl`
**And** worker CD SHALL connect to Jira at `sync-cd.jira.baseUrl`
**And** credentials SHALL not be shared between workers

### Requirement: Per-Worker Sync Interval

Each worker SHALL have its own sync interval in its config file.

**Rationale:** Allow different sync frequencies for different workers.

#### Scenario: Worker reads interval from config

**Given** a config file with `syncIntervalMinutes: 10`
**When** the worker starts
**Then** it SHALL use that interval for scheduling
**And** it SHALL NOT use the global `SYNC_INTERVAL_MINUTES` env var

#### Scenario: Different intervals for different workers

**Given** worker AB with `syncIntervalMinutes: 5`
**And** worker CD with `syncIntervalMinutes: 15`
**When** both workers are running
**Then** AB SHALL sync every 5 minutes
**And** CD SHALL sync every 15 minutes

### Requirement: Config Loader Parses New Fields

The config loader SHALL parse `jira` object and `syncIntervalMinutes` from config files.

**Rationale:** Extract per-worker settings for use by workers.

#### Scenario: Config loader extracts jira settings

**Given** a valid config file with `jira` section
**When** `loadConfigs()` is called
**Then** each returned config SHALL include `config.jira`
**And** `config.jira.baseUrl` SHALL be a non-empty string
**And** `config.jira.apiToken` SHALL be a non-empty string

#### Scenario: Config loader extracts sync interval

**Given** a valid config file with `syncIntervalMinutes`
**When** `loadConfigs()` is called
**Then** each returned config SHALL include `syncIntervalMinutes`
**And** the value SHALL be a positive number

## MODIFIED Requirements

### Requirement: Config Structure Update

The config file structure SHALL include `jira` object and `syncIntervalMinutes` field.

**From:**
```json
{
  "userProjectKey": "...",
  "devProjectKey": "..."
}
```

**To:**
```json
{
  "jira": {
    "baseUrl": "...",
    "email": "...",
    "apiToken": "...",
    "authType": "pat"
  },
  "userProjectKey": "...",
  "devProjectKey": "...",
  "syncIntervalMinutes": 5
}
```

**Rationale:** Consolidate per-worker settings in config file.

#### Scenario: Config file includes all required fields

**Given** a new config file based on the example
**When** the worker starts
**Then** it SHALL have all settings needed for operation
**And** it SHALL NOT require any environment variables for Jira settings

### Requirement: Environment Variables as Fallback

Environment variables SHALL be used as fallback when config file does not provide values.

**From:** Environment variables are primary config source
**To:** Config file is primary, environment variables are fallback

**Rationale:** Backward compatibility for existing deployments.

#### Scenario: Fallback to environment variables

**Given** a config file without `jira` section
**When** the worker starts
**Then** it SHALL use `JIRA_BASE_URL` from environment
**And** it SHALL use `JIRA_API_TOKEN` from environment
**And** it SHALL use `JIRA_EMAIL` from environment

#### Scenario: Fallback for sync interval

**Given** a config file without `syncIntervalMinutes`
**When** the worker starts
**Then** it SHALL use `SYNC_INTERVAL_MINUTES` from environment
**And** if not set, default to 5 minutes

## REMOVED Requirements

- The requirement for `JIRA_BASE_URL` in `.env` SHALL be removed for per-worker deployments.
- The requirement for `JIRA_EMAIL` in `.env` SHALL be removed for per-worker deployments.
- The requirement for `JIRA_API_TOKEN` in `.env` SHALL be removed for per-worker deployments.
- The requirement for `SYNC_INTERVAL_MINUTES` in `.env` SHALL be removed for per-worker deployments.

**Rationale:** These settings are now configured per-worker in config files.

#### Scenario: Simplified environment file

**Given** the project after this change
**When** reading `.env.example`
**Then** it SHALL NOT contain `JIRA_BASE_URL`
**And** it SHALL NOT contain `JIRA_EMAIL`
**And** it SHALL NOT contain `JIRA_API_TOKEN`
**And** it SHALL NOT contain `SYNC_INTERVAL_MINUTES`
