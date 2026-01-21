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
import { SyncFlowConfigDoc, SyncRule } from '../db/models.js';
import { findMatchingRule } from './config-loader.js';

const buildAuthHeader = (): Record<string, string> => {
  if (config.jira.authType === 'pat') {
    return { Authorization: `Bearer ${config.jira.apiToken}` };
  }
  const token = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
  return { Authorization: `Basic ${token}` };
};

const copyAttachmentsToDev = async (userIssue: any, devIssueKey: string): Promise<void> => {
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

const renderCommentTemplate = (template: string, sourceKey: string, targetKey: string): string => {
  return template.replace(/\$\{sourceKey\}/g, sourceKey).replace(/\$\{targetKey\}/g, targetKey);
};

const executeRuleActions = async (
  issue: any,
  rule: SyncRule,
  existingMapping: any
): Promise<void> => {
  const actions = rule.actions;
  if (!actions) return;

  if (actions.createIssue) {
    const userIssueUrl = buildUserProjectIssueUrl(issue.key);
    const devIssue = await createDevIssue({
      summary: issue.fields.summary ?? issue.key,
      description: issue.fields.description ?? '',
      severity: issue.fields.severity,
      userIssueUrl,
    });

    if (actions.syncAttachments) {
      await copyAttachmentsToDev(issue, devIssue.key);
    }

    if (actions.addCrossLink) {
      await updateUserProjectDescriptionWithDevLink(
        issue.key,
        issue.fields.description,
        devIssue.url
      );
    }

    await createMapping({
      userIssueKey: issue.key,
      devIssueKey: devIssue.key,
      userIssueUrl,
      devIssueUrl: buildDevProjectIssueUrl(devIssue.key),
    });

    if (actions.addComment && actions.commentTemplate) {
      const comment = renderCommentTemplate(actions.commentTemplate, issue.key, devIssue.key);
      await commentUserIssue(issue.key, comment);
    }

    logger.info(
      { userIssue: issue.key, devIssue: devIssue.key },
      'Synced User project -> Dev project'
    );
    return;
  }

  if (actions.syncStatus && existingMapping) {
    const targetStatus = actions.targetStatus || rule.sourceStatus;
    await transitionDevIssueStatus(existingMapping.dev_issue_key, targetStatus);

    if (actions.addComment && actions.commentTemplate) {
      const comment = renderCommentTemplate(actions.commentTemplate, issue.key, existingMapping.dev_issue_key);
      await commentUserIssue(issue.key, comment);
    }

    logger.info(
      { userIssue: issue.key, devIssue: existingMapping.dev_issue_key },
      'Mirrored User status -> Dev status'
    );
  }
};

export const syncUserProjectToDevProject = async (
  lastSync: Date | null,
  syncConfig: SyncFlowConfigDoc
): Promise<void> => {
  const issues = await getUpdatedUserProjectIssues(lastSync);

  for (const issue of issues) {
    const statusName = issue.fields?.status?.name;
    const rule = findMatchingRule(syncConfig.rules, statusName, 'user_to_dev');

    if (!rule) continue;

    const description = issue.fields?.description;
    const hasDevLink = descriptionHasIssueLinkForProject(
      description,
      config.jira.devProjectKey
    );

    const existingMapping = await getMappingByUserKey(issue.key);

    const requireMapping = rule.conditions?.requireMapping ?? true;
    if (requireMapping && !existingMapping) {
      logger.debug(
        { userIssue: issue.key, sourceStatus: statusName },
        'Skipping User issue: no mapping exists and rule requires mapping'
      );
      continue;
    }

    if (rule.actions?.createIssue && hasDevLink) {
      logger.debug(
        { userIssue: issue.key },
        'Skipping User issue: Dev link already exists'
      );
      continue;
    }

    await executeRuleActions(issue, rule, existingMapping);
  }
};
