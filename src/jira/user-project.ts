import { jiraClient, JiraIssue } from './client.js';
import { config, buildIssueUrl } from '../config/index.js';
import { appendLinkToDescription } from './description.js';

export const getUpdatedUserProjectIssues = async (
  updatedSince: Date | null,
  doFullSync: boolean = false
): Promise<JiraIssue[]> => {
  const projectKey = config.jira.userProjectKey;
  const fields = [
    'summary',
    'description',
    'status',
    'severity',
    'replied',
    'updated',
    'attachment',
  ];
  return jiraClient.searchIssues({
    jql: `project = ${projectKey} ORDER BY updated ASC`,
    fields,
    updatedSince: updatedSince ?? undefined,
    ignoreTimeFilter: doFullSync,
  });
};

export const updateUserProjectDescriptionWithDevLink = async (
  issueKey: string,
  currentDescription: string | null | undefined,
  devIssueUrl: string
): Promise<void> => {
  const description = appendLinkToDescription(currentDescription, devIssueUrl, 'Dev Link');
  const existing = typeof currentDescription === 'string' ? currentDescription : '';
  if (description === existing) {
    return;
  }
  await jiraClient.updateIssue(issueKey, { description });
};

export const commentUserIssue = async (
  issueKey: string,
  body: string
): Promise<void> => jiraClient.addComment(issueKey, body);

export const resolveUserIssue = async (
  issueKey: string,
  skipStatusChange?: boolean,
  targetStatus = 'Resolved'
): Promise<void> => {
  if (!skipStatusChange) {
    await jiraClient.transitionIssue(issueKey, targetStatus);
  }
  // Some Jira instances block setting custom fields via REST without screen configuration; ignore errors here
  try {
    await jiraClient.updateIssue(issueKey, { replied: true });
  } catch (err) {
    // log at debug level to avoid failing the whole sync when field is not accessible
    // eslint-disable-next-line no-console
    console.warn(`Skipping replied update for ${issueKey}:`, (err as Error).message);
  }
};

export const transitionUserIssueStatus = async (
  issueKey: string,
  targetStatus: string
): Promise<void> => jiraClient.transitionIssue(issueKey, targetStatus);

export const getUserProjectIssue = async (
  issueKey: string
): Promise<JiraIssue> =>
  jiraClient.getIssue(issueKey, [
    'status',
    'replied',
    'description',
  ]);

export const buildUserProjectIssueUrl = (issueKey: string): string =>
  buildIssueUrl(issueKey);

export const getUserProjectStatuses = async (): Promise<any[]> => {
  return jiraClient.getProjectStatuses(config.jira.userProjectKey);
};

export const getStatusCategoryMap = async (): Promise<Map<string, string>> => {
  try {
    const statuses = await getUserProjectStatuses();
    const map = new Map<string, string>();
    statuses.forEach((issueType: any) => {
      issueType.statuses.forEach((s: any) => {
        if (s.name && s.statusCategory?.key) {
          map.set(s.name.toLowerCase(), s.statusCategory.key);
        }
      });
    });
    return map;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to fetch user project statuses for category check', err);
    return new Map();
  }
};

export const isResolutionStatus = (status: string, categoryMap: Map<string, string>): boolean => {
  const category = categoryMap.get(status.toLowerCase());
  return category === 'done';
};
