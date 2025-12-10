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
  const description = appendLinkToDescription(currentDescription, devIssueUrl);
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
  skipStatusChange?: boolean
): Promise<void> => {
  if (!skipStatusChange) {
    await jiraClient.transitionIssue(issueKey, 'Resolved');
  }
  await jiraClient.updateIssue(issueKey, { replied: true });
};

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
