import { logger } from '../config/index.js';
import {
  getUpdatedDevProjectIssues,
  updateDevProjectDescriptionWithUserLink,
} from '../jira/dev-project.js';
import {
  commentUserIssue,
  resolveUserIssue,
  getUserProjectIssue,
  buildUserProjectIssueUrl,
} from '../jira/user-project.js';
import { getMappingByDevKey } from '../db/repo.js';
import { descriptionHasLink } from '../jira/description.js';

export const syncDevProjectToUserProject = async (
  lastSync: Date | null
): Promise<void> => {
    const issues = await getUpdatedDevProjectIssues(lastSync);

    for (const issue of issues) {
      const statusName = issue.fields?.status?.name;
      if (statusName !== 'Done') {
        continue;
      }

      const mapping = await getMappingByDevKey(issue.key);
      if (!mapping) {
        continue;
      }

      const userIssueKey = mapping.user_issue_key;
      const userIssue = await getUserProjectIssue(userIssueKey);
      const userStatus = userIssue.fields?.status?.name;
      const skipStatusChange = userStatus === 'Resolved' || userStatus === 'Closed';

      const userIssueUrl = buildUserProjectIssueUrl(userIssueKey);
      const hasUserIssueLink = descriptionHasLink(
        issue.fields?.description,
        userIssueUrl
      );
      if (!hasUserIssueLink) {
        await updateDevProjectDescriptionWithUserLink(
          issue.key,
          issue.fields?.description,
          userIssueUrl
        );
      }

      await commentUserIssue(
        userIssueKey,
        `Lỗi đã được xử lý tại issue ${issue.key}`
      );
      await resolveUserIssue(userIssueKey, skipStatusChange);

      logger.info(
        { devIssue: issue.key, userIssue: userIssueKey },
        'Synced Dev project -> User project'
      );
    }
  };
