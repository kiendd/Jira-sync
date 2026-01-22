# cleanup Specification

## Purpose
TBD - created by archiving change cleanup-project. Update Purpose after archive.
## Requirements
### Requirement: Remove Scripts Folder

The `scripts/` directory and all its contents SHALL be removed from the project.

**Rationale:** Scripts in `scripts/` duplicate npm command functionality, causing maintenance burden.

#### Scenario: Scripts folder deletion

**Given** the project contains a `scripts/` directory
**When** the cleanup change is applied
**Then** the `scripts/` directory shall no longer exist
**And** `ls scripts/` shall return an error

#### Scenario: npm scripts still functional

**Given** the cleanup change has been applied
**When** running `npm run sync:init`
**Then** the command shall execute successfully
**And** `npm run test:auth` shall execute successfully
**And** `npm run test:list-user-project` shall execute successfully
**And** `npm run test:sync-cycle` shall execute successfully

### Requirement: Remove Duplicate Documentation

The files `GEMINI.md` and `Workflow.md` SHALL be removed from the project.

**Rationale:** Documentation is duplicated across multiple files, making maintenance harder.

#### Scenario: Duplicate docs deletion

**Given** the project contains `GEMINI.md` and `Workflow.md`
**When** the cleanup change is applied
**Then** both files shall no longer exist
**And** `ls GEMINI.md Workflow.md` shall return errors

### Requirement: Merge Documentation to README

Essential workflow documentation from deleted files SHALL be merged into `README.md`.

**Rationale:** Single source of truth for documentation improves maintainability.

#### Scenario: Workflow content merged

**Given** the cleanup change has been applied
**When** reading `README.md`
**Then** it shall contain a synchronization workflow section
**And** it shall contain key commands documentation
**And** it shall contain project setup instructions

#### Scenario: README remains valid

**Given** the cleanup change has been applied
**When** reading `README.md`
**Then** it shall be valid markdown
**And** all links and references shall be accurate

### Requirement: Documentation Location Consolidation

Documentation SHALL exist in a single location (`README.md`) instead of multiple files.

**Rationale:** Consolidating documentation improves maintainability.

#### Scenario: Documentation consolidation

**Given** the project before cleanup
**And** documentation exists in multiple files
**When** the cleanup change is applied
**Then** all essential documentation shall exist in `README.md`
**And** no duplicate documentation files shall remain

### Requirement: No Environment Variable Fallback

The system MUST NOT read JIRA configuration from environment variables.

The system MUST fail with a clear error message when JSON config files are missing.

The system MUST NOT support legacy environment variable configuration.

#### Scenario: Startup with JSON Config Files

**Given** the `config/` directory contains valid JSON config files
**And** JIRA environment variables are not set
**When** the service starts
**Then** it loads configuration from JSON files
**And** it starts successfully

#### Scenario: Startup without JSON Config Files

**Given** the `config/` directory is empty or missing
**When** the service starts
**Then** it fails with a clear error message
**And** the error message explains how to create JSON config files
**And** it exits with a non-zero exit code

#### Scenario: Environment Variables Are Ignored

**Given** JIRA environment variables are set (JIRA_BASE_URL, JIRA_API_TOKEN, etc.)
**When** the service starts
**Then** it ignores these environment variables
**And** it loads configuration from JSON config files only
**And** it starts successfully (if JSON files exist)

### Requirement: docker-compose.yml Cleanup

The `docker-compose.yml` file MUST NOT contain JIRA environment variables.

The `docker-compose.yml` file SHALL retain infrastructure environment variables:
- `DATABASE_URL`
- `SYNC_INTERVAL_MINUTES`
- `LOG_LEVEL`
- `PORT`
- `CONFIG_DIR`

The `docker-compose.yml` file MAY contain infrastructure variable defaults.

#### Scenario: Docker Compose without JIRA Vars

**Given** the `docker-compose.yml` file does not contain `JIRA_BASE_URL`, `JIRA_API_TOKEN`, `JIRA_EMAIL`, `JIRA_AUTH_TYPE`, `USER_PROJECT_KEY`, or `DEV_PROJECT_KEY`
**When** the container starts with valid JSON config files
**Then** it starts successfully
**And** it reads configuration from the mounted JSON files

#### Scenario: Container Fails without Config Files

**Given** the `docker-compose.yml` file does not contain JIRA environment variables
**And** the `config/` directory is empty or missing
**When** the container starts
**Then** it fails with a clear error message about missing config files
**And** it does not attempt to use environment variables

### Requirement: Multiple JIRA Instances Support

The system MUST support running multiple workers with different JIRA configurations.

Each worker SHALL read its JIRA configuration from a separate JSON config file.

Each worker SHALL use a separate database for sync state.

#### Scenario: Multiple Workers with Different JIRA Instances

**Given** `config/sync-ab.json` with Jira A credentials
**And** `config/sync-cd.json` with Jira B credentials
**When** the service starts
**Then** it spawns two workers
**And** worker AB connects to Jira A
**And** worker CD connects to Jira B

#### Scenario: Each Worker Uses Separate Database

**Given** worker config with `name: "sync-ab"`
**When** the worker connects to MongoDB
**Then** it uses database `sync_ab`
**And** worker with `name: "sync-cd"` uses database `sync_cd`

### Requirement: Config Validation

The system MUST validate JSON config files before spawning workers.

The system MUST check for required fields:
- `name` (string)
- `jira.baseUrl` (string)
- `jira.apiToken` (string)
- `jira.email` (string, required for basic auth)
- `userProjectKey` (string)
- `devProjectKey` (string)

#### Scenario: Missing Required Field

**Given** a JSON config file missing `jira.apiToken`
**When** the service starts
**Then** it fails with error: "Missing required field: jira.apiToken"
**And** it does not spawn workers

#### Scenario: Invalid JSON Syntax

**Given** a JSON config file with syntax errors
**When** the service starts
**Then** it fails with error: "Invalid JSON in config/sync-ab.json"
**And** it provides the parse error details

#### Scenario: Valid Config File

**Given** a JSON config file with all required fields
**When** the service starts
**Then** it validates the config successfully
**And** it spawns the worker with this config

### Requirement: Documentation Update

The `DEPLOY.md` file MUST be updated to reflect JSON-only configuration.

The `DEPLOY.md` file MUST provide example JSON config files.

The `DEPLOY.md` file MUST include migration steps from env vars to JSON config.

The `DEPLOY.md` file MUST document how to configure multiple JIRA instances.

#### Scenario: Deploy Docs Show JSON Config

**Given** the `DEPLOY.md` file has been updated
**When** a new user reads it
**Then** they understand how to create JSON config files
**And** they know where to place config files (config/ directory)

#### Scenario: Multiple JIRA Documentation

**Given** the `DEPLOY.md` file has been updated
**When** an operator wants to sync multiple Jira instances
**Then** they find instructions for creating multiple config files
**And** they understand how workers are spawned for each config

#### Scenario: Migration Guide

**Given** an existing deployment uses environment variables
**When** the operator reads `DEPLOY.md`
**Then** they find steps to:
  1. Export current configuration to JSON format
  2. Create config file in config/ directory
  3. Remove JIRA env vars from docker-compose.yml
  4. Restart the service

### Requirement: Error Messages

The system MUST provide clear, actionable error messages.

Error messages MUST NOT reference environment variables.

Error messages MUST reference the correct config file path.

#### Scenario: Clear Error for Missing Config Directory

**Given** the config directory does not exist
**When** the service fails to start
**Then** the error message includes:
  - "Configuration directory not found: /app/config"
  - "Create the config directory and add at least one sync-*.json file"
  - "See DEPLOY.md for configuration guide"

#### Scenario: Clear Error for Missing Required Field

**Given** a config file is missing `userProjectKey`
**When** the service fails to start
**Then** the error message includes:
  - "Missing required field 'userProjectKey' in config/sync-ab.json"
  - "Each config file must specify userProjectKey and devProjectKey"

