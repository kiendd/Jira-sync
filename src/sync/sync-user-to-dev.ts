import { logger, config } from '../config/index.js';
import {
  getUpdatedUserProjectIssues,
  updateUserProjectDescriptionWithDevLink,
  commentUserIssue,
  buildUserProjectIssueUrl,
} from '../jira/user-project.js';
import {
  createDevIssue,
  buildDevProjectIssueUrl,
  transitionDevIssueStatus,
  addAttachmentToDevIssue,
} from '../jira/dev-project.js';
import { createMapping, getMappingByUserKey } from '../db/repo.js';
import { descriptionHasIssueLinkForProject } from '../jira/description.js';

const buildAuthHeader = (): Record<string, string> => {
  if (config.jira.authType === 'pat') {
    return { Authorization: `Bearer ${config.jira.apiToken}` };
  }
  const token = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
  return { Authorization: `Basic ${token}` };
};

const copyAttachmentsToDev = async (
  userIssue: any,
  devIssueKey: string
): Promise<void> => {
  const attachments: any[] = Array.isArray(userIssue.fields?.attachment) ? userIssue.fields.attachment : [];
  if (!attachments.length) return;

  const headers = buildAuthHeader();
  for (const att of attachments) {
    const url = att?.content;
    const filename = att?.filename || att?.id || 'attachment';
    if (!url) continue;

    try {
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        logger.warn({ url, status: resp.status }, 'Failed to download attachment');
        continue;
      }
      const arrayBuf = await resp.arrayBuffer();
      const mimeType = resp.headers.get('content-type')?.split(';')[0] || undefined;
      await addAttachmentToDevIssue({
        issueKey: devIssueKey,
        filename,
        data: Buffer.from(arrayBuf),
        mimeType,
      });
    } catch (err) {
      logger.warn({ err, url }, 'Error copying attachment to Dev issue');
    }
  }
};

export const syncUserProjectToDevProject = async (
  lastSync: Date | null
): Promise<void> => {
  const issues = await getUpdatedUserProjectIssues(lastSync);

  for (const issue of issues) {
    const statusName = issue.fields?.status?.name;
    const description = issue.fields?.description;
    const hasDevLink = descriptionHasIssueLinkForProject(
      description,
      config.jira.devProjectKey
    );

    const existingMapping = await getMappingByUserKey(issue.key);

    if (statusName === 'Will Do') {
      if (hasDevLink) {
        continue;
      }
      if (existingMapping) {
        continue;
      }

      const userIssueUrl = buildUserProjectIssueUrl(issue.key);
      const devIssue = await createDevIssue({
        summary: issue.fields.summary ?? issue.key,
        description: issue.fields.description ?? '',
        severity: issue.fields.severity,
        userIssueUrl,
      });

      await copyAttachmentsToDev(issue, devIssue.key);

      await updateUserProjectDescriptionWithDevLink(
        issue.key,
        description,
        devIssue.url
      );

      await createMapping({
        userIssueKey: issue.key,
        devIssueKey: devIssue.key,
        userIssueUrl,
        devIssueUrl: buildDevProjectIssueUrl(devIssue.key),
      });

      await commentUserIssue(issue.key, `Đã tạo Dev Issue: ${devIssue.key}`);
      logger.info(
        { userIssue: issue.key, devIssue: devIssue.key },
        'Synced User project -> Dev project'
      );
      continue;
    }

    if (statusName === 'Reopened' && existingMapping) {
      await transitionDevIssueStatus(existingMapping.dev_issue_key, 'Reopened');
      logger.info(
        { userIssue: issue.key, devIssue: existingMapping.dev_issue_key },
        'Mirrored User Reopened -> Dev Reopened'
      );
    }
  }
};
