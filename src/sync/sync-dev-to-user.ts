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
import { getMappingByDevKey, getDevProjectIssueState, upsertDevProjectIssueState } from '../db/repo.js';
import { descriptionHasLink } from '../jira/description.js';

export const syncDevProjectToUserProject = async (
  lastSync: Date | null
): Promise<void> => {
  const issues = await getUpdatedDevProjectIssues(lastSync);

  for (const issue of issues) {
    const statusName = issue.fields?.status?.name;
    const normalizedStatus = typeof statusName === 'string' ? statusName.trim() : '';
    // Only mirror statuses that affect User; Dev "Done" is treated as intermediate (skip sync)
    const interestedStatuses = ['In Progress', 'Closed', 'Cancelled', 'Reopened'];
    if (!interestedStatuses.includes(normalizedStatus)) {
      continue;
    }

    const mapping = await getMappingByDevKey(issue.key);
    const devState = await getDevProjectIssueState(issue.key);
    const previousStatus = devState?.status ?? '';
    const statusChanged = previousStatus !== normalizedStatus;

    if (!mapping) {
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    if (!statusChanged) {
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
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

    if (normalizedStatus === 'Closed') {
      const skipStatusChange = userStatus === 'Resolved' || userStatus === 'Closed';
      await resolveUserIssue(userIssueKey, skipStatusChange, 'Resolved');
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
      await commentUserIssue(
        userIssueKey,
        `Issue DEV ${issue.key} đã được Reopened, cần xử lý lại`
      );
    }

    await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });

    logger.info(
      { devIssue: issue.key, userIssue: userIssueKey, status: normalizedStatus },
      'Synced Dev project -> User project'
    );
  }
};
