import { logger } from '../config/index.js';
import { getUpdatedUserProjectIssues } from '../jira/user-project.js';
import { getUpdatedDevProjectIssues } from '../jira/dev-project.js';
import { getLastStatusSync, updateLastStatusSync } from '../db/repo.js';
import { detectStatusChange, ProjectType, StatusChange } from './issue-state-tracker.js';
import { logIssueFetched, SyncMetrics } from './audit-logger.js';

const fetchProjectIssues = async (
  projectType: ProjectType,
  lastSync: Date | null,
  doFullSync: boolean
): Promise<any[]> => {
  if (projectType === 'user') {
    return getUpdatedUserProjectIssues(lastSync, doFullSync);
  } else {
    return getUpdatedDevProjectIssues(lastSync, doFullSync);
  }
};

const processIssuesForStatusChanges = async (
  projectType: ProjectType,
  issues: any[],
  doFullSync: boolean,
  metrics: SyncMetrics
): Promise<StatusChange[]> => {
  const changes: StatusChange[] = [];

  for (const issue of issues) {
    const currentStatus = issue.fields?.status?.name ?? 'Unknown';
    const issueTitle = issue.fields?.summary ?? issue.key;

    metrics.incrementIssuesFetched();

    logIssueFetched(
      issue.key,
      issueTitle,
      projectType,
      currentStatus,
      issue.fields?.updated ?? null
    );

    const change = await detectStatusChange(issue.key, projectType, currentStatus);

    if (change) {
      changes.push(change);
      metrics.incrementStatusChangesDetected();
    }
  }

  return changes;
};

export const monitorAllProjects = async (
  doFullSync: boolean = false,
  metrics?: SyncMetrics
): Promise<StatusChange[]> => {
  const lastStatusSync = await getLastStatusSync();
  const allChanges: StatusChange[] = [];

  logger.info({ lastSync: lastStatusSync, fullSync: doFullSync }, 'Starting project monitoring');

  const userIssues = await fetchProjectIssues('user', lastStatusSync, doFullSync);
  logger.info({ count: userIssues.length, project: 'user' }, 'Fetched User project issues');

  const devIssues = await fetchProjectIssues('dev', lastStatusSync, doFullSync);
  logger.info({ count: devIssues.length, project: 'dev' }, 'Fetched Dev project issues');

  const effectiveMetrics = metrics ?? new SyncMetrics('monitor');

  const userChanges = await processIssuesForStatusChanges('user', userIssues, doFullSync, effectiveMetrics);
  allChanges.push(...userChanges);

  const devChanges = await processIssuesForStatusChanges('dev', devIssues, doFullSync, effectiveMetrics);
  allChanges.push(...devChanges);

  logger.info(
    { userChanges: userChanges.length, devChanges: devChanges.length, total: allChanges.length },
    'Status monitoring completed'
  );

  await updateLastStatusSync(new Date());

  return allChanges;
};
