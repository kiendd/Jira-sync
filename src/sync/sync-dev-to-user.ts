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
  transitionUserIssueStatus,
} from '../jira/user-project.js';
import { getMappingByDevKey } from '../db/repo.js';
import { descriptionHasLink } from '../jira/description.js';

export const syncDevProjectToUserProject = async (
  lastSync: Date | null
): Promise<void> => {
  const issues = await getUpdatedDevProjectIssues(lastSync);

  for (const issue of issues) {
    const statusName = issue.fields?.status?.name;
    const normalizedStatus = typeof statusName === 'string' ? statusName.trim() : '';
    const interestedStatuses = ['In Progress', 'Resolved', 'Done', 'Cancelled', 'Reopened'];
    if (!interestedStatuses.includes(normalizedStatus)) {
      continue;
    }

    const mapping = await getMappingByDevKey(issue.key);
    if (!mapping) {
      continue;
    }

    const userIssueKey = mapping.user_issue_key;
    const userIssue = await getUserProjectIssue(userIssueKey);
    const userStatus = userIssue.fields?.status?.name ?? '';

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

    if (normalizedStatus === 'In Progress') {
      if (userStatus !== 'In Progress') {
        await transitionUserIssueStatus(userIssueKey, 'In Progress');
      }
    }

    if (normalizedStatus === 'Resolved') {
      const skipStatusChange = userStatus === 'Resolved' || userStatus === 'Done' || userStatus === 'Closed';
      await resolveUserIssue(userIssueKey, skipStatusChange, 'Resolved');
    }

    if (normalizedStatus === 'Done') {
      const skipStatusChange = userStatus === 'Done' || userStatus === 'Closed';
      await resolveUserIssue(userIssueKey, skipStatusChange, 'Done');
      await commentUserIssue(
        userIssueKey,
        `Lỗi đã được xử lý tại issue ${issue.key}`
      );
    }

    if (normalizedStatus === 'Cancelled') {
      if (userStatus !== 'Cancelled') {
        await transitionUserIssueStatus(userIssueKey, 'Cancelled');
      }
    }

    if (normalizedStatus === 'Reopened') {
      if (userStatus !== 'Reopened') {
        await transitionUserIssueStatus(userIssueKey, 'Reopened');
      }
    }

    logger.info(
      { devIssue: issue.key, userIssue: userIssueKey, status: normalizedStatus },
      'Synced Dev project -> User project'
    );
  }
};
