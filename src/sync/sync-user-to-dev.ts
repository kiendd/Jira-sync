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
import { StatusChange } from './issue-state-tracker.js';
import {
  logIssueFetched,
  logIssueProcessed,
  logActionCreateIssue,
  logActionSyncStatus,
  logActionSkipped,
} from './audit-logger.js';

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

    logActionCreateIssue(
      issue.key,
      issue.fields.summary ?? issue.key,
      'user',
      devIssue.key,
      'dev',
      'Open'
    );

    logIssueProcessed(
      issue.key,
      issue.fields.summary ?? issue.key,
      'user',
      issue.fields?.status?.name ?? 'Unknown',
      rule.id ?? rule.sourceStatus,
      'createIssue',
      devIssue.key,
      false
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

    logActionSyncStatus(
      issue.key,
      issue.fields?.status?.name ?? 'Unknown',
      existingMapping.dev_issue_key,
      targetStatus,
      'user_to_dev'
    );

    logIssueProcessed(
      issue.key,
      issue.fields.summary ?? issue.key,
      'user',
      issue.fields?.status?.name ?? 'Unknown',
      rule.id ?? rule.sourceStatus,
      'syncStatus',
      existingMapping.dev_issue_key,
      true
    );
  }
};

export const syncUserProjectToDevProject = async (
  lastSync: Date | null,
  syncConfig: SyncFlowConfigDoc,
  doFullSync: boolean = false
): Promise<void> => {
  const issues = await getUpdatedUserProjectIssues(lastSync, doFullSync);

  for (const issue of issues) {
    const statusName = issue.fields?.status?.name ?? 'Unknown';
    const issueTitle = issue.fields?.summary ?? issue.key;

    logIssueFetched(
      issue.key,
      issueTitle,
      'user',
      statusName,
      issue.fields?.updated ?? null
    );

    const rule = findMatchingRule(syncConfig.rules, statusName, 'user_to_dev');

    if (!rule) {
      logIssueProcessed(
        issue.key,
        issueTitle,
        'user',
        statusName,
        'none',
        'noRule'
      );
      continue;
    }

    const description = issue.fields?.description;
    const hasDevLink = descriptionHasIssueLinkForProject(
      description,
      config.jira.devProjectKey
    );

    const existingMapping = await getMappingByUserKey(issue.key);

    const requireMapping = rule.conditions?.requireMapping ?? true;
    if (requireMapping && !existingMapping) {
      logActionSkipped(
        issue.key,
        'requireMapping',
        `Rule ${rule.id ?? rule.sourceStatus} requires mapping`
      );
      continue;
    }

    if (rule.actions?.createIssue && hasDevLink) {
      logActionSkipped(
        issue.key,
        'hasLink',
        'Dev link already exists in description'
      );
      continue;
    }

    await executeRuleActions(issue, rule, existingMapping);
  }
};

export const syncUserStatusChangesToDevProject = async (
  statusChanges: StatusChange[],
  syncConfig: SyncFlowConfigDoc
): Promise<void> => {
  const userChanges = statusChanges.filter((c) => c.projectType === 'user');

  for (const change of userChanges) {
    const rule = findMatchingRule(syncConfig.rules, change.toStatus, 'user_to_dev');

    if (!rule) {
      logActionSkipped(
        change.issueKey,
        'noRule',
        `No rule for status "${change.toStatus}"`
      );
      continue;
    }

    const existingMapping = await getMappingByUserKey(change.issueKey);

    const requireMapping = rule.conditions?.requireMapping ?? true;
    if (requireMapping && !existingMapping && !rule.actions?.createIssue) {
      logActionSkipped(
        change.issueKey,
        'requireMapping',
        `Rule ${rule.id ?? rule.sourceStatus} requires mapping`
      );
      continue;
    }

    if (rule.actions?.createIssue && !existingMapping) {
      const issue = { key: change.issueKey, fields: { summary: change.issueKey, description: '' } };
      await executeRuleActions(issue, rule, null);
      continue;
    }

    if (rule.actions?.syncStatus && existingMapping) {
      const targetStatus = rule.actions.targetStatus || rule.sourceStatus;
      await transitionDevIssueStatus(existingMapping.dev_issue_key, targetStatus);

      if (rule.actions.addComment && rule.actions.commentTemplate) {
        const comment = renderCommentTemplate(
          rule.actions.commentTemplate,
          change.issueKey,
          existingMapping.dev_issue_key
        );
        await commentUserIssue(change.issueKey, comment);
      }

      logActionSyncStatus(
        change.issueKey,
        change.toStatus,
        existingMapping.dev_issue_key,
        targetStatus,
        'user_to_dev'
      );

      logIssueProcessed(
        change.issueKey,
        change.issueKey,
        'user',
        change.toStatus,
        rule.id ?? rule.sourceStatus,
        'syncStatus',
        existingMapping.dev_issue_key,
        true
      );
    }
  }
};
