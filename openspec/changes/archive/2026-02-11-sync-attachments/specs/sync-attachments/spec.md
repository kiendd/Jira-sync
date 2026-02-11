# Spec: Sync Attachments

## ADDED Requirements

### Requirement: Sync on Create

When a new Dev issue is created from a User issue, all attachments present on the User issue MUST be copied to the Dev issue.

#### Scenario: User issue has valid attachments
- Given a User issue "USER-1" with attachment "log.txt"
- When the sync job runs and creates "DEV-1"
- Then "DEV-1" must have an attachment named "log.txt" with identical content.

#### Scenario: Download failure
- Given a User issue "USER-1" with attachment "error.png"
- When the sync job fails to download "error.png" (e.g., 404 or 403)
- Then the sync should log a warning
- And the Dev issue creation should proceed (partial success).

### Requirement: Sync on Update

When a User issue is updated with a new attachment, it MUST be copied to the existing mapped Dev issue.

#### Scenario: New attachment added
- Given "USER-1" is already mapped to "DEV-1"
- And "USER-1" receives a new attachment "screenshot.png"
- When the sync job runs
- Then "DEV-1" must receive "screenshot.png".

#### Scenario: Existing attachments
- Given "USER-1" has "log.txt" synced to "DEV-1"
- When the sync job runs again
- Then "log.txt" should NOT be re-uploaded to "DEV-1".
