# Configuration Hardening

## ADDED Requirements

### Requirement: Strict Configuration Injection
The system SHALL require explicit configuration for all sync operations.
The system SHALL NOT fall back to default "empty" or hardcoded rules if external configuration is missing.

#### Scenario: Scheduler Startup
- GIVEN the scheduler is starting
- WHEN no configuration object is provided
- THEN the application SHALL fail to compile (TypeScript error) OR throw an immediate runtime error

#### Scenario: Worker Execution
- GIVEN a worker process
- WHEN it attempts to run a sync cycle
- THEN it must use the specific configuration loaded for that worker
- AND NOT the default global configuration
