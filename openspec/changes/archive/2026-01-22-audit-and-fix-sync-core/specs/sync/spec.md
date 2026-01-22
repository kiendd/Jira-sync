# Audit and Fix Sync Core

## ADDED Requirements

### Requirement: Robust Startup and Dynamic Status
The system SHALL validate Jira connectivity and project existence at startup. It SHALL terminate if validation fails.
The system SHALL support dynamic resolution statuses by checking the `statusCategory` of the target status. If the category is `done`, it SHALL treat the issue as resolved.

#### Scenario: Startup Validation - Success
- GIVEN valid `JIRA_BASE_URL` and credentials
- AND valid `USER_PROJECT_KEY` and `DEV_PROJECT_KEY`
- WHEN the worker starts
- THEN it should proceed to start the scheduler

#### Scenario: Startup Validation - Failure
- GIVEN invalid credentials OR non-existent project keys
- WHEN the worker starts
- THEN it should log an error and exit with code 1

#### Scenario: Dynamic Resolution (Dev Done -> User Done)
- GIVEN a rule mapping Dev "Done" to User "Done"
- AND User "Done" has status category "Done" (or "Complete")
- WHEN Dev issue moves to "Done"
- THEN User issue transitions to "Done"
- AND User issue is marked as "replied"

#### Scenario: Dynamic Resolution (Dev Closed -> User Resolved)
- GIVEN a rule mapping Dev "Closed" to User "Resolved"
- AND User "Resolved" has status category "Done"
- WHEN Dev issue moves to "Closed"
- THEN User issue transitions to "Resolved"
- AND User issue is marked as "replied"
