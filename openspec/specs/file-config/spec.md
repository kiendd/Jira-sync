# file-config Specification

## Purpose
TBD - created by archiving change sync-config-file. Update Purpose after archive.
## Requirements
### Requirement: Configuration File Location

The system MUST support reading sync configuration from a JSON file located at a configurable path.

The default path SHALL be `config/sync-rules.json` relative to the project root.

The path SHALL be configurable via the `SYNC_CONFIG_PATH` environment variable.

**Rationale:** Allows flexibility for different deployment environments while providing a sensible default.

#### Scenario: Default Config File Path

**Given** the `SYNC_CONFIG_PATH` environment variable is not set
**When** the ConfigLoader loads configuration
**Then** it reads from `config/sync-rules.json`

#### Scenario: Custom Config File Path

**Given** the `SYNC_CONFIG_PATH` environment variable is set to `/etc/jira-sync/rules.json`
**When** the ConfigLoader loads configuration
**Then** it reads from `/etc/jira-sync/rules.json`

#### Scenario: Absolute Path

**Given** `SYNC_CONFIG_PATH` is set to an absolute path `/data/config/sync.json`
**When** the ConfigLoader loads configuration
**Then** it reads from the specified absolute path

### Requirement: JSON File Format

The configuration file MUST be valid JSON (optionally with comments via JSON5).

The file SHALL contain a single object with the following structure:

- `name` (string, required): Configuration name
- `userProjectKey` (string, required): User project key
- `devProjectKey` (string, required): Dev project key
- `defaultBehavior` (object, optional): Default sync behaviors
- `rules` (array, required): List of sync rules

**Rationale:** Structured format matches the existing schema, allowing easy migration from database config.

#### Scenario: Valid JSON File

**Given** a valid JSON file at the configured path
**When** the ConfigLoader parses the file
**Then** it returns the parsed configuration
**And** the configuration is used for sync operations

#### Scenario: JSON with Comments

**Given** a JSON5 file containing comments (e.g., `// This is a comment`)
**When** the ConfigLoader parses the file
**Then** it successfully parses the file
**And** comments are ignored

#### Scenario: Invalid JSON

**Given** a file containing invalid JSON syntax
**When** the ConfigLoader parses the file
**Then** it logs an error
**And** it falls back to the embedded default configuration

### Requirement: ConfigLoader File Reading

The ConfigLoader SHALL read the configuration file on each sync cycle.

The ConfigLoader SHALL cache the configuration for the duration of a sync cycle.

The ConfigLoader SHALL validate the configuration after reading.

**Rationale:** Simple approach without file watching complexity. Changes picked up on next sync cycle.

#### Scenario: Read on Each Sync Cycle

**Given** a valid configuration file exists
**When** a sync cycle runs
**Then** the ConfigLoader reads the file
**And** the current file content is used

#### Scenario: File Not Found

**Given** the configuration file does not exist
**When** the ConfigLoader loads configuration
**Then** it logs an info message
**And** it returns the embedded default configuration

#### Scenario: Permission Denied

**Given** the configuration file exists but is not readable
**When** the ConfigLoader reads the file
**Then** it logs an error
**And** it returns the embedded default configuration

### Requirement: Configuration Validation

The ConfigLoader MUST validate the configuration structure before using it.

Validation MUST check:
- Required fields are present
- Field types are correct
- Rules array contains valid rule objects

Invalid configurations SHALL fall back to the embedded default configuration.

**Rationale:** Prevents sync failures due to misconfiguration.

#### Scenario: Missing Required Field

**Given** a configuration file missing the `name` field
**When** the configuration is validated
**Then** the configuration is marked invalid
**And** the default configuration is used

#### Scenario: Invalid Rule

**Given** a rule missing the `sourceStatus` field
**When** the configuration is validated
**Then** the configuration is marked invalid
**And** the default configuration is used

#### Scenario: Valid Configuration

**Given** a configuration with all required fields and valid rules
**When** the configuration is validated
**Then** the configuration is accepted
**And** it is used for sync operations

### Requirement: Embedded Default Configuration

The system SHALL embed a default configuration that maintains current behavior.

The embedded default configuration SHALL be used when:
- The configuration file is missing
- The configuration file is invalid
- File reading fails

**Rationale:** Ensures the service works even without a configuration file.

#### Scenario: Use Default When File Missing

**Given** no configuration file exists
**When** the ConfigLoader loads configuration
**Then** the embedded default configuration is returned
**And** sync behavior matches the expected current implementation

#### Scenario: Use Default When Invalid

**Given** an invalid configuration file
**When** the ConfigLoader loads configuration
**Then** the embedded default configuration is returned
**And** a warning is logged

### Requirement: Migration from Database Config

The system SHALL provide documentation for migrating from database configuration to file configuration.

Migration steps SHALL include:
1. Export current configuration from MongoDB
2. Convert to JSON format
3. Save to file
4. Verify and restart

**Rationale:** Helps existing deployments transition to file-based configuration.

#### Scenario: Export Database Config

**Given** a deployment with database-stored configuration
**When** the operator follows migration documentation
**Then** they can export the configuration to a JSON file
**And** save it to the configured path

