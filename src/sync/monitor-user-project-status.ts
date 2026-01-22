import { logger } from '../config/index.js';
import { getUpdatedUserProjectIssues } from '../jira/user-project.js';
import {
  getLastStatusSync,
  updateLastStatusSync,
  getUserProjectIssueState,
  upsertUserProjectIssueState,
} from '../db/repo.js';

export const monitorUserProjectStatuses = async (): Promise<void> => {
  logger.warn('monitorUserProjectStatuses is deprecated. Use monitorAllProjects instead.');

  const lastStatusSync = await getLastStatusSync();
  const issues = await getUpdatedUserProjectIssues(lastStatusSync);

  for (const issue of issues) {
    const currentStatus = issue.fields?.status?.name ?? 'Unknown';
    const existing = await getUserProjectIssueState(issue.key);
    const previousStatus = existing?.status;

    const isClosed = currentStatus.toLowerCase() === 'closed';
    const statusChanged = previousStatus && previousStatus !== currentStatus;

    if (statusChanged && !isClosed) {
      logger.info(
        { issue: issue.key, from: previousStatus, to: currentStatus },
        'User project issue status changed'
      );
    }

    await upsertUserProjectIssueState({
      issueKey: issue.key,
      status: currentStatus,
    });
  }

  await updateLastStatusSync(new Date());
};
