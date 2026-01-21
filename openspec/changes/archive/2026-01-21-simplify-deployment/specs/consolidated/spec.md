# Spec: Consolidated Deployment

## ADDED Requirements

### Requirement: Single Docker Compose File

The project SHALL provide a single `docker-compose.yml` file for deployment.

**Rationale:** Simplify deployment by providing one deployment method.

#### Scenario: Compose File Exists

**Given** the project is checked out
**When** listing files in the root directory
**Then** the file `docker-compose.yml` exists
**And** it can be parsed by `docker-compose config`

#### Scenario: Single Container Configuration

**Given** the docker-compose.yml file
**When** checking the services
**Then** it defines exactly one `jira-sync` service
**And** it defines exactly one `mongo` service

### Requirement: Environment Template

The project SHALL provide an `.env.example` file with all required environment variables.

**Rationale:** Document all required configuration for deployment.

#### Scenario: Environment Template Exists

**Given** the project is checked out
**When** listing files in the root directory
**Then** the file `.env.example` exists
**And** it documents all required variables

#### Scenario: Required Variables Documented

**Given** the environment template
**When** checking the content
**Then** it documents `JIRA_BASE_URL`
**And** it documents `JIRA_API_TOKEN`
**And** it documents `USER_PROJECT_KEY`
**And** it documents `DEV_PROJECT_KEY`
**And** it documents `DATABASE_NAME`

### Requirement: Multi-Config Directory

The system SHALL load sync configurations from the `config/` directory.

**Rationale:** Allow multiple sync pairs to be configured from JSON files.

#### Scenario: Config Files in Directory

**Given** the project is checked out
**When** listing files in the `config/` directory
**Then** it contains one or more `sync-*.json` files
**And** each file is valid JSON
**And** each file contains `userProjectKey` and `devProjectKey`

#### Scenario: Dynamic Config Loading

**Given** config files exist in `config/`
**When** the service starts
**Then** it SHALL scan for all `sync-*.json` files
**And** it SHALL spawn a worker for each config

### Requirement: Health Check Endpoint

The service SHALL expose a `/health` endpoint reporting worker status.

**Rationale:** Enable container orchestration to verify service health.

#### Scenario: Health Endpoint Returns Status

**Given** the service is running
**When** making a request to `http://localhost:3000/health`
**Then** it SHALL return HTTP 200
**And** the response SHALL include `status: "healthy"` or `"degraded"`
**And** the response SHALL include a list of workers

### Requirement: Database Isolation per Worker

Each worker SHALL use a separate MongoDB database on the shared MongoDB instance.

**Rationale:** Ensure data isolation while sharing a single MongoDB container.

#### Scenario: Workers Use Separate Databases

**Given** two workers: `sync-ab` and `sync-cd`
**When** they store data
**Then** `sync-ab` uses database `sync_ab`
**And** `sync-cd` uses database `sync_cd`
**And** data does not mix between workers

## MODIFIED Requirements

### Requirement: Simplified Configuration

The project SHALL provide a single `docker-compose.yml` file.

**From:** Multiple compose files (multi and consolidated)
**To:** Single `docker-compose.yml` file

**Rationale:** Reduce complexity by providing one deployment method.

#### Scenario: Single Compose File

**Given** the project root
**When** listing docker-compose files
**Then** only `docker-compose.yml` exists
**And** no `docker-compose.multi.yml` or `docker-compose.consolidated.yml` exists

## REMOVED Requirements

- The requirement for `docker-compose.multi.yml` SHALL be removed.
- The requirement for `.env.multi.example` SHALL be removed.
- The requirement for multiple sync containers SHALL be removed.

**Rationale:** Consolidated deployment provides sufficient functionality with simpler architecture.

#### Scenario: Multi-Instance Files Removed

**Given** the project before cleanup
**When** after applying this change
**Then** `docker-compose.multi.yml` does not exist
**And** `.env.multi.example` does not exist
**And** only one `docker-compose.yml` file exists
