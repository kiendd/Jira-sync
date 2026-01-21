# Spec: Sync Flow Configuration

**Change ID:** `configure-sync-flow`

**Capability:** `sync-flow-config`

## ADDED Requirements

### Requirement: Configuration Storage

The system MUST store sync flow configuration in MongoDB collection `sync_flow_config` with the following schema:

- `name` (string, required): Human-readable config name
- `user_project_key` (string, required): User project key
- `dev_project_key` (string, required): Dev project key
- `rules` (array): Ordered list of sync rules
- `default_behavior` (object): Default sync behaviors
- `created_at` (Date): Creation timestamp
- `updated_at` (Date): Last update timestamp

**Rationale:** Database storage enables runtime configuration changes without code deployment.

#### Scenario: Save Configuration

**Given** a valid `SyncFlowConfig` object
**When** the configuration is saved to the database
**Then** the configuration is stored with `created_at` or `updated_at` timestamps
**And** the configuration can be retrieved by name

#### Scenario: Retrieve Configuration

**Given** a saved configuration with name "default"
**When** the configuration is retrieved
**Then** all rules, behaviors, and metadata are returned
**And** invalid configurations return null

### Requirement: Sync Rules Definition

Each sync rule MUST define:

- `source_status` (string): Status in source project that triggers sync
- `target_project` (enum): Target project ('dev' or 'user')
- `target_status` (string, optional): Mapped status in target project
- `sync_direction` (enum): When to sync ('user_to_dev', 'dev_to_user', 'both', 'none')
- `enabled` (boolean): Whether the rule is active
- `actions` (object): Actions to perform on match

**Rationale:** Declarative rules allow operators to define sync behavior without code changes.

#### Scenario: Match Status Trigger

**Given** a User issue with status "Will Do"
**When** the sync engine processes the issue
**Then** it searches rules for `source_status: "Will Do"` and `sync_direction` including 'user_to_dev'
**And** the first matching enabled rule is applied

#### Scenario: Skip Disabled Rule

**Given** a rule with `enabled: false`
**When** an issue matches the rule's source status
**Then** the rule is skipped
**And** subsequent rules in the list are evaluated

#### Scenario: Status Mapping

**Given** a rule with `source_status: "Fixed"` and `target_status: "Resolved"`
**When** the rule is applied
**Then** the target issue status is set to "Resolved" instead of "Fixed"

### Requirement: Sync Direction Control

The system MUST support the following sync directions per rule:

- `user_to_dev`: Only sync from User project to Dev project
- `dev_to_user`: Only sync from Dev project to User project
- `both`: Sync bidirectionally for this status
- `none`: Disable sync for this status (effectively disabled)

**Rationale:** Direction control allows unidirectional sync configurations.

#### Scenario: Unidirectional Sync

**Given** a rule with `sync_direction: "dev_to_user"` for status "In Progress"
**When** a Dev issue transitions to "In Progress"
**Then** the User issue status is updated
**When** a User issue transitions to "In Progress"
**Then** no sync action occurs

#### Scenario: Bidirectional Sync

**Given** a rule with `sync_direction: "both"` for status "Reopened"
**When** a User issue transitions to "Reopened"
**Then** the Dev issue status is updated
**When** a Dev issue transitions to "Reopened"
**Then** the User issue status is updated

### Requirement: Rule Actions

Each rule MAY define actions to perform on match, and the system SHALL support the following action types:

- `create_issue` (boolean): Create target issue if no mapping exists (uses source issueType)
- `sync_status` (boolean): Mirror status changes to target
- `sync_attachments` (boolean): Copy attachments to target issue
- `add_comment` (boolean): Add auto-generated comment on sync
- `comment_template` (string): Template for comments (variables: ${sourceKey}, ${targetKey})

**Rationale:** Granular actions allow fine-tuned control over sync behavior.

#### Scenario: Create Issue on Match

**Given** a rule with `actions.create_issue: true`
**When** a User issue matches but has no Dev mapping
**Then** a new Dev issue is created
**And** a mapping is established between the issues
**And** cross-links are added to both issue descriptions

#### Scenario: Skip Issue Creation

**Given** a rule with `actions.create_issue: false`
**When** a User issue matches but has no Dev mapping
**Then** no Dev issue is created
**And** the issue is skipped with a debug log

#### Scenario: Custom Comment Template

**Given** a rule with `actions.comment_template: "Synced from ${sourceKey}"`
**When** the rule is applied
**Then** a comment is added with the template populated
**And** `${sourceKey}` is replaced with the source issue key

### Requirement: Default Configuration

The system MUST provide a default configuration that maintains backward compatibility with current behavior:

- User "Will Do" → Create Dev issue
- User "Reopened" → Mirror to Dev "Reopened"
- Dev "In Progress" → Mirror to User "In Progress"
- Dev "Closed" → Mirror to User "Resolved"
- Dev "Cancelled" → Mirror to User "Cancelled"

**Rationale:** Existing deployments must continue working without configuration changes.

#### Scenario: Default Config Applied

**Given** no configuration exists in the database
**When** the sync engine loads configuration
**Then** the embedded default configuration is used
**And** sync behavior matches the current hardcoded implementation

#### Scenario: Custom Config Overrides Default

**Given** a configuration named "default" exists in the database
**When** the sync engine loads configuration
**Then** the database configuration is used instead of the default
**And** the database configuration takes precedence

### Requirement: Configuration Validation

The system MUST validate configuration before use:

- Required fields must be present
- Enum values must be valid
- Rules array must contain valid rule objects
- Invalid configurations fall back to default

**Rationale:** Prevent sync failures due to misconfiguration.

#### Scenario: Validate Required Fields

**Given** a configuration missing the `name` field
**When** the configuration is validated
**Then** the configuration is marked invalid
**And** the default configuration is used instead

#### Scenario: Validate Enum Values

**Given** a rule with `sync_direction: "invalid_direction"`
**When** the configuration is validated
**Then** the configuration is marked invalid
**And** the default configuration is used instead

#### Scenario: Validate Rule Structure

**Given** a rule missing the `source_status` field
**When** the configuration is validated
**Then** the configuration is marked invalid
**And** the default configuration is used instead

### Requirement: ConfigLoader Service

The system MUST provide a `ConfigLoader` service that:

- Loads configuration from database or falls back to default
- Validates configuration before returning
- Caches configuration for the duration of a sync cycle
- Logs configuration loading outcomes

**Rationale:** Centralized configuration management with safe defaults.

#### Scenario: Load Valid Config

**Given** a valid configuration exists in the database
**When** `ConfigLoader.loadConfig()` is called
**Then** the configuration is returned
**And** no default config is used

#### Scenario: Fallback to Default

**Given** an invalid configuration in the database
**When** `ConfigLoader.loadConfig()` is called
**Then** the default configuration is returned
**And** a warning is logged indicating the invalid config

#### Scenario: Empty Database

**Given** no configuration in the database
**When** `ConfigLoader.loadConfig()` is called
**Then** the default configuration is returned
**And** no warning is logged (expected state)

## Cross-Reference

- **Related Capability:** `none` (initial capability)
- **Related Files:**
  - `src/db/models.ts`: SyncFlowConfig model
  - `src/db/sync-config-repo.ts`: Configuration repository
  - `src/sync/config-loader.ts`: Configuration loader service
  - `src/sync/sync-user-to-dev.ts`: Refactored to use config
  - `src/sync/sync-dev-to-user.ts`: Refactored to use config
- **Related Environment Variables:** None (config is database-driven)
