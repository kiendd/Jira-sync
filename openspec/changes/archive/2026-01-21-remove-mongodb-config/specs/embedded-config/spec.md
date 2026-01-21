# Spec: Embedded Sync Configuration

**Change ID:** `remove-mongodb-config`

**Capability:** `embedded-config`

## ADDED Requirements

### Requirement: No Database Configuration Storage

The system SHALL NOT store sync configuration in MongoDB `sync_flow_config` collection.

**Rationale:** MongoDB storage adds complexity without significant value for most use cases.

#### Scenario: No Database Config

**Given** the sync service is running
**When** the system checks for configuration
**Then** it does NOT query MongoDB for configuration
**And** it uses only the embedded default configuration

#### Scenario: No Config Collection

**Given** the `sync_flow_config` collection exists in MongoDB
**When** the sync service runs
**Then** the collection is ignored
**And** the embedded default configuration is used

### Requirement: No SyncConfigRepository

The system SHALL NOT have a `SyncConfigRepository` class.

**Rationale:** No longer needed without database configuration.

#### Scenario: Repository Not Imported

**Given** the sync service is compiled
**When** searching for `SyncConfigRepository` imports
**Then** no imports are found
**And** the file `src/db/sync-config-repo.ts` does not exist

### Requirement: ConfigLoader Synchronous Operation

The `ConfigLoader.loadConfig()` method SHALL NOT make database calls.

**Rationale:** Configuration is now embedded, no runtime database access needed.

#### Scenario: Synchronous Config Loading

**Given** the ConfigLoader is instantiated
**When** `loadConfig()` is called
**Then** it returns immediately with the default configuration
**And** no database connection is required
**And** no async/await is needed

#### Scenario: No Database Dependencies

**Given** the sync service is starting
**When** checking configuration loading
**Then** no MongoDB queries are executed
**And** the service can run without the `sync_flow_config` collection existing

### Requirement: Embedded Default Configuration

The system SHALL provide an embedded default configuration that maintains current sync behavior.

**Rationale:** Ensures consistent behavior without external configuration.

#### Scenario: Default Config Available

**Given** the sync service is running
**When** the configuration is loaded
**Then** the embedded default configuration is available
**And** it matches the previously documented sync behavior

#### Scenario: Config Structure

**Given** the embedded default configuration
**When** inspecting the structure
**Then** it contains `name`, `userProjectKey`, `devProjectKey`, `rules` fields
**And** `rules` is an array of sync rules
**And** each rule has `sourceStatus`, `targetProject`, `syncDirection`, `enabled`, `actions`

### Requirement: Scheduler Synchronous Config Loading

The scheduler SHALL call `syncConfigLoader.loadConfig()` synchronously without await.

**Rationale:** Simplified API for embedded configuration.

#### Scenario: Synchronous Scheduler

**Given** the scheduler runs a sync cycle
**When** loading configuration
**Then** it uses synchronous `loadConfig()` call
**And** no await keyword is needed

#### Scenario: Config Loading Pattern

**Given** the scheduler code
**When** loading configuration
**Then** it uses the pattern `const syncConfig = syncConfigLoader.loadConfig();`
**And** it does not use `await syncConfigLoader.loadConfig();`

### Requirement: No External Dependencies for Config

The configuration loading SHALL NOT depend on external services.

**Rationale:** Improves reliability and simplifies deployment.

#### Scenario: Offline Config

**Given** the sync service is running
**When** MongoDB is unavailable
**Then** the service starts successfully
**And** the sync configuration is loaded
**And** sync operations work normally

#### Scenario: No Network for Config

**Given** the sync service is configured
**When** network connectivity is lost
**Then** configuration is still available
**And** no connection errors occur

## Cross-Reference

- **Related Change:** `configure-sync-flow` (supersedes database storage)
- **Related Files:**
  - `src/sync/config-loader.ts`: Simplified to return embedded config
  - `src/db/sync-config-repo.ts`: Deleted
  - `src/db/models.ts`: SyncFlowConfigModel removed
- **Related Environment Variables:** None (no config path needed)
