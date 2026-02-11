# Proposal: Sync Attachments from User to Dev

## Problem
Attachments added to User issues are not being synced to the corresponding Dev issues. This leads to missing context for developers and requires them to check the User issue manually. The current implementation only attempts to sync attachments on issue creation, and there are reports that even this is failing.

## Solution
Implement robust attachment synchronization:
1.  **Fix attachment sync on creation:** Ensure the download and upload process handles authentication and redirects correctly.
2.  **Implement attachment sync on update:** Detect when new attachments are added to a User issue and sync them to the Dev issue.

## Risks
- **Performance:** Downloading and uploading large files can be slow and consume memory. We should stream data if possible.
- **Duplication:** Need to ensure we don't upload the same attachment multiple times.
- **Security:** Ensure credentials are handled safely during the download/upload process.
