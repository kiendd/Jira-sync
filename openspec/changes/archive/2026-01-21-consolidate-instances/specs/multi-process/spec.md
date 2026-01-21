# Spec: Multi-Process Sync Execution

## ADDED Requirements

### Requirement: Multi-Config Directory Loading

The system SHALL scan a config directory and load all valid sync configuration files.

**Rationale:** Enable running multiple sync pairs from a single container.

#### Scenario: Load all config files

**Given** a config directory containing multiple JSON files
**When** the config loader scans the directory
**Then** it SHALL parse all files matching the pattern `sync-*.json`
**And** it SHALL return an array of sync configurations
**And** each configuration SHALL include `userProjectKey` and `devProjectKey`

#### Scenario: Invalid config files are skipped

**Given** a config directory containing valid and invalid JSON files
**When** the config loader processes the directory
**Then** invalid files SHALL be logged as warnings
**And** valid configurations SHALL still be loaded
**And** the system SHALL NOT crash on invalid files

### Requirement: Child Process Spawning

The main process SHALL spawn a child process for each sync configuration.

**Rationale:** Isolate each sync pair in its own process for independent scheduling.

#### Scenario: One worker per config

**Given** 3 valid sync configurations are loaded
**When** the process manager starts
**Then** it SHALL spawn exactly 3 child processes
**And** each child process SHALL receive its configuration via IPC
**And** each child process SHALL run an independent scheduler

#### Scenario: Worker process crashes and restarts

**Given** a child process for sync pair AB crashes
**When** the process detects the crash
**Then** it SHALL log the error
**And** it SHALL attempt to restart the worker
**And** other workers SHALL continue running independently

### Requirement: Database Isolation per Worker

Each worker SHALL use a separate MongoDB database on the shared MongoDB instance.

**Rationale:** Ensure data isolation while sharing a single MongoDB container.

#### Scenario: Worker connects to assigned database

**Given** a worker for sync pair AB has database name `sync_ab`
**When** the worker initializes its MongoDB connection
**Then** it SHALL connect to `mongodb://mongo:27017/sync_ab`
**And** it SHALL create collections only within `sync_ab`
**And** data for sync pair CD SHALL be in `sync_cd` database

#### Scenario: Multiple databases exist on MongoDB

**Given** a MongoDB instance with databases `sync_ab`, `sync_cd`, `sync_xy`
**When** each worker connects
**Then** workers SHALL not interfere with each other's data
**And** each worker SHALL only see its own collections

### Requirement: Independent Scheduling per Worker

Each worker SHALL run its own sync scheduler with configurable interval.

**Rationale:** Allow different sync intervals for different sync pairs.

#### Scenario: Worker has independent scheduler

**Given** a worker for sync pair AB with `SYNC_INTERVAL_MINUTES=5`
**When** the worker starts
**Then** it SHALL run sync cycles every 5 minutes
**And** a worker for sync pair CD with `SYNC_INTERVAL_MINUTES=10`
**Then** it SHALL run sync cycles every 10 minutes
**And** the schedules SHALL run independently

#### Scenario: Worker sends heartbeat

**Given** all workers are running
**When** each worker completes a sync cycle
**Then** it SHALL send a heartbeat message to the main process
**And** the main process SHALL track the last heartbeat time for each worker

### Requirement: Health Check Endpoint

The main process SHALL expose a health check endpoint reporting all workers' status.

**Rationale:** Enable container orchestration to verify all workers are healthy.

#### Scenario: Health endpoint returns all worker statuses

**Given** the container is running with 3 workers
**When** a health check request is made to `http://localhost:3000/health`
**Then** it SHALL return JSON with status for all workers
**And** the response SHALL include `status: "healthy"` if all workers are running
**And** the response SHALL include `status: "degraded"` if some workers are down

#### Scenario: Health endpoint fails if no workers

**Given** all worker processes have crashed
**When** a health check request is made
**Then** it SHALL return HTTP 503
**And** the response SHALL include error details

## MODIFIED Requirements

### Requirement: Scheduler Configuration per Worker

Each worker SHALL run its own scheduler with a configurable interval.

**From:** Single global scheduler with one sync interval
**To:** Per-worker scheduler with configurable intervals per sync pair

**Rationale:** Allow different sync frequencies for different sync pairs.

#### Scenario: Different intervals per worker

**Given** sync pair AB configured with `SYNC_INTERVAL_MINUTES=5`
**And** sync pair CD configured with `SYNC_INTERVAL_MINUTES=15`
**When** both workers are running
**Then** AB SHALL sync every 5 minutes
**And** CD SHALL sync every 15 minutes

## REMOVED Requirements

- The requirement for one Docker container per sync pair SHALL be removed.
- The requirement for one MongoDB container per sync pair SHALL be removed.

**Rationale:** Resource consolidation reduces overhead while maintaining isolation at database level.

#### Scenario: Single container replaces multiple

**Given** the consolidated deployment is configured
**When** checking running containers
**Then** exactly one `jira-sync` container SHALL be running
**And** exactly one `mongo` container SHALL be running
**And** all configured sync pairs SHALL be active within the single container
