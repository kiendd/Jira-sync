# cleanup Specification

## Purpose
Remove redundant `DATABASE_NAME` loading from `config/index.ts`. The `DATABASE_URL` stays in environment variables (shared MongoDB instance), while `DATABASE_NAME` is correctly derived per-worker from worker name.

## ADDED Requirements

### Requirement: Remove Redundant Database Name Config

The system MUST NOT load `DATABASE_NAME` from environment variables in `config/index.ts`.

The `DATABASE_NAME` SHALL be derived from worker name automatically.

The worker SHALL receive `DATABASE_NAME` via `process.env.DATABASE_NAME` set by `process-manager.ts`.

#### Scenario: Worker Gets Database Name from Process Manager

**Given** a worker with name "sync-ab"
**When** the worker starts
**Then** it uses `process.env.DATABASE_NAME` which is set to "sync-ab"
**And** it connects to database "sync_ab"

#### Scenario: Config Index Has No Database Name

**Given** `config/index.ts` does not export `databaseName`
**When** the code is compiled
**Then** it compiles successfully
**And** no code references `config.databaseName`

### Requirement: Keep Database URL Global

The system MUST keep `DATABASE_URL` in environment variables.

All workers SHALL share the same MongoDB instance via `DATABASE_URL`.

The `DATABASE_URL` SHALL be configurable via docker-compose.yml or .env.

#### Scenario: Database URL from Environment

**Given** `DATABASE_URL` is set to `mongodb://mongo:27017`
**When** workers connect to MongoDB
**Then** they all use this shared MongoDB instance

#### Scenario: Docker Compose Sets Database URL

**Given** `docker-compose.yml` contains `DATABASE_URL: mongodb://mongo:27017`
**When** the container starts
**Then** workers connect to this MongoDB instance

### Requirement: Worker Uses Derived Database Name

Each worker SHALL use a database name derived from its worker name.

The database name format SHALL be `<worker_name>_sync` by default.

The worker name comes from the `name` field in JSON config file.

#### Scenario: Worker AB Uses Database sync_ab

**Given** a JSON config file with `"name": "sync-ab"`
**When** the worker starts
**Then** it uses database `sync_ab`

#### Scenario: Worker CD Uses Database sync_cd

**Given** a JSON config file with `"name": "sync-cd"`
**When** the worker starts
**Then** it uses database `sync_cd`

### Requirement: Documentation Update

The `DEPLOY.md` file MUST clarify the database configuration model.

The documentation MUST explain that `DATABASE_URL` is global (environment variable).

The documentation MUST explain that `DATABASE_NAME` is derived from worker name.

#### Scenario: Deploy Docs Show Database Config

**Given** the `DEPLOY.md` file has been updated
**When** an operator reads it
**Then** they understand `DATABASE_URL` is set in docker-compose.yml
**And** they understand database names are auto-derived

#### Scenario: Multiple Workers Documentation

**Given** the `DEPLOY.md` file has been updated
**When** an operator wants to understand multi-worker database isolation
**Then** they learn each worker uses `<name>_sync` database
