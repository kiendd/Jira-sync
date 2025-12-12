import { jiraClient, JiraIssue } from './client.js';
import { config, buildIssueUrl } from '../config/index.js';
import { appendLinkToDescription } from './description.js';

const projectKey = config.jira.userProjectKey;

export const getUpdatedUserProjectIssues = async (
  updatedSince: Date | null
): Promise<JiraIssue[]> => {
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
