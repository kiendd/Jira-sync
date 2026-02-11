# Tasks

1.  **Validate current behavior:**
    -   Create a reproduction script to confirm if `userIssue.fields.attachment` is populated and if `fetch` fails.
    -   Verify if the issue is due to auth headers or redirects.

2.  **Fix sync on creation:**
    -   Update `copyAttachmentsToDev` to use a more robust download method (handling redirects/auth).
    -   Ensure `getUpdatedUserProjectIssues` requests the `attachment` field (confirmed it does).

3.  **Implement sync on update:**
    -   Modify `syncUserProjectToDevProject` to check for new attachments on existing issues.
    -   Compare attachments between User and Dev issues (by filename/size or valid check) to avoid duplicates.
    -   Upload missing attachments to Dev.

4.  **Testing:**
    -   Verify with `npm run test:sync-cycle` (or a specific test script).
    -   Manual verification with a test issue.
