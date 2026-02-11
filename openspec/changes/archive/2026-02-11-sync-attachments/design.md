# Design

## Attachment Download
The current implementation uses `fetch` with a manually constructed `Authorization` header.
-   **Issue:** `fetch` might lose the `Authorization` header on redirects (common with Jira content URLs).
-   **Solution:** Use a wrapper around `fetch` that handles redirects while preserving auth, OR use the existing `jira.js` client if it exposes a helper.
    -   Alternatively, `jira.js`'s `Version2Client` has a `request` method that might handle auth automatically.

## Sync Logic (Update)
To sync on update without re-uploading everything:
1.  **Get Dev Issue Attachments:** Fetch the current attachments of the mapped Dev issue.
2.  **Compare:** For each attachment in the User issue, check if a matching file (name + size) exists in the Dev issue.
3.  **Upload:** If not found, download from User and upload to Dev.
4.  **Optimization:** Only perform this check if the User issue's `updated` timestamp is recent, or if we explicitly detect an attachment change (though Jira webhook/changelog analysis is not currently used, we rely on polling).

## Data Flow
User Issue -> `getUpdatedUserProjectIssues` (includes `attachment`) -> `syncUserProjectToDevProject` -> `copyAttachmentsToDev` (refactored to `syncAttachments`) -> Dev Issue.
