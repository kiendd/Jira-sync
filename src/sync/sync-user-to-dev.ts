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
  getDevProjectIssue,
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

const downloadAttachment = async (url: string, headers: Record<string, string>): Promise<{ data: Buffer, mimeType?: string } | null> => {
  try {
    // Attempt download. If generic fetch fails, try manual redirect handling for cases where
    // simple 'follow' might not work as expected with Auth headers across origins (though fetch should handle it).
    // For now, we rely on standard fetch but log strictly.
    const res = await fetch(url, { headers });

    if (!res.ok) {
      // Fallback: try manual redirect if status is 3xx (fetch might not return 3xx with redirect:follow unless manual)
      // actually default is follow. If it failed with 404/403, maybe auth issue.
      logger.warn({ url, status: res.status }, 'Download failed, trying manual redirect check ignored for now');
      return null;
    }

    const arrayBuf = await res.arrayBuffer();
    const mimeType = res.headers.get('content-type')?.split(';')[0] || undefined;
    return { data: Buffer.from(arrayBuf), mimeType };
  } catch (err) {
    logger.warn({ err, url }, 'Error downloading attachment');
    return null;
  }
};

const copyAttachmentsToDev = async (userIssue: any, devIssueKey: string): Promise<void> => {
  const attachments: any[] = Array.isArray(userIssue.fields?.attachment) ? userIssue.fields.attachment : [];
  if (!attachments.length) return;

  const headers = buildAuthHeader();
  for (const att of attachments) {
    const url = att?.content;
    const filename = att?.filename || att?.id || 'attachment';
    if (!url) continue;

    const result = await downloadAttachment(url, headers);
    if (result) {
      try {
        await addAttachmentToDevIssue({
          issueKey: devIssueKey,
          filename,
          data: result.data,
          mimeType: result.mimeType,
        });
        logger.info({ userIssue: userIssue.key, devIssue: devIssueKey, filename }, 'Synced attachment');
      } catch (err) {
        logger.error({ err, filename }, 'Failed to upload attachment to Dev issue');
      }
    }
  }
};

const syncAttachmentsOnUpdate = async (userIssue: any, devIssueKey: string): Promise<void> => {
  try {
    const userAttachments: any[] = Array.isArray(userIssue.fields?.attachment) ? userIssue.fields.attachment : [];
    if (!userAttachments.length) return;

    const devIssue = await getDevProjectIssue(devIssueKey);
    const devAttachments: any[] = Array.isArray(devIssue.fields?.attachment) ? devIssue.fields.attachment : [];

    const headers = buildAuthHeader();

    for (const uAtt of userAttachments) {
      // Check if exists in dev (by filename and size)
      const exists = devAttachments.some(dAtt => dAtt.filename === uAtt.filename && dAtt.size === uAtt.size);
      if (exists) continue;

      logger.info({ issue: userIssue.key, filename: uAtt.filename }, 'Found new attachment to sync');
      const url = uAtt.content;
      if (!url) continue;

      const result = await downloadAttachment(url, headers);
      if (result) {
        await addAttachmentToDevIssue({
          issueKey: devIssueKey,
          filename: uAtt.filename,
          data: result.data,
          mimeType: result.mimeType,
        });
        logger.info({ userIssue: userIssue.key, devIssue: devIssueKey, filename: uAtt.filename }, 'Synced new attachment on update');
      }
    }
  } catch (err) {
    logger.error({ err, userIssue: userIssue.key, devIssue: devIssueKey }, 'Failed to sync attachments on update');
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

    // Always check for attachment updates if mapped and enabled
    if (existingMapping && syncConfig.defaultBehavior?.syncAttachments) {
      await syncAttachmentsOnUpdate(issue, existingMapping.dev_issue_key);
    }
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
