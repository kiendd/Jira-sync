import { jiraClient, JiraIssue } from './client.js';
import { config, buildIssueUrl } from '../config/index.js';
import { appendLinkToDescription } from './description.js';

export const getUpdatedDevProjectIssues = async (
  updatedSince: Date | null,
  doFullSync: boolean = false
): Promise<JiraIssue[]> => {
  const projectKey = config.jira.devProjectKey;
  const fields = [
    'summary',
    'description',
    'status',
    'severity',
    'updated',
  ];
  return jiraClient.searchIssues({
    jql: `project = ${projectKey} ORDER BY updated ASC`,
    fields,
    updatedSince: updatedSince ?? undefined,
    ignoreTimeFilter: doFullSync,
  });
};

export const createDevIssue = async (params: {
  summary: string;
  description?: string;
  severity?: any;
  userIssueUrl: string;
}): Promise<{ key: string; id: string; url: string }> => {
  const projectKey = config.jira.devProjectKey;
  const description = appendLinkToDescription(
    params.description ?? '',
    params.userIssueUrl,
    'User Link'
  );
  const fields: Record<string, any> = {
    project: { key: projectKey },
    summary: params.summary,
    description,
    issuetype: { name: 'Bug' },
  };

  if (params.severity !== undefined) {
    fields.severity = params.severity;
  }

  return jiraClient.createIssue(fields);
};

export const updateDevProjectDescriptionWithUserLink = async (
  issueKey: string,
  currentDescription: string | null | undefined,
  userIssueUrl: string
): Promise<void> => {
  const description = appendLinkToDescription(currentDescription, userIssueUrl, 'User Link');
  const existing = typeof currentDescription === 'string' ? currentDescription : '';
  if (description === existing) {
    return;
  }

  await jiraClient.updateIssue(issueKey, { description });
};

export const buildDevProjectIssueUrl = (issueKey: string): string =>
  buildIssueUrl(issueKey);

export const transitionDevIssueStatus = async (
  issueKey: string,
  targetStatus: string
): Promise<void> => jiraClient.transitionIssue(issueKey, targetStatus);

export const addAttachmentToDevIssue = async (params: {
  issueKey: string;
  filename: string;
  data: ArrayBuffer | Uint8Array | Buffer;
  mimeType?: string;
}): Promise<void> => {
  await jiraClient.addAttachment({
    issueKey: params.issueKey,
    filename: params.filename,
    data: params.data,
    mimeType: params.mimeType,
  });
};
