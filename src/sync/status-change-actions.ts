import { logger, config } from '../config/index.js';
import { SyncRule } from '../db/models.js';
import { StatusChange } from './issue-state-tracker.js';
import { getMappingByUserKey, getMappingByDevKey, createMapping } from '../db/repo.js';
import {
  getUserProjectIssue,
  commentUserIssue,
  buildUserProjectIssueUrl,
  transitionUserIssueStatus,
  resolveUserIssue,
  getStatusCategoryMap,
  isResolutionStatus
} from '../jira/user-project.js';
import { createDevIssue, buildDevProjectIssueUrl, transitionDevIssueStatus } from '../jira/dev-project.js';
import { descriptionHasIssueLinkForProject } from '../jira/description.js';

const renderCommentTemplate = (template: string, sourceKey: string, targetKey: string): string => {
  return template.replace(/\$\{sourceKey\}/g, sourceKey).replace(/\$\{targetKey\}/g, targetKey);
};

const renderStatusTemplate = (template: string, sourceKey: string): string => {
  return template.replace(/\$\{sourceKey\}/g, sourceKey);
};

const getTargetStatus = (rule: SyncRule, statusChange: StatusChange): string => {
  if (rule.actions?.targetStatus) {
    return renderStatusTemplate(rule.actions.targetStatus, statusChange.issueKey);
  }
  return statusChange.toStatus;
};

export const executeStatusChangeAction = async (
  statusChange: StatusChange,
  rule: SyncRule
): Promise<void> => {
  const actions = rule.actions;
  if (!actions) return;

  if (statusChange.projectType === 'user') {
    const userIssueKey = statusChange.issueKey;
    const existingMapping = await getMappingByUserKey(userIssueKey);

    if (actions.createIssue && !existingMapping) {
      const description = `Created from status change: ${statusChange.fromStatus} -> ${statusChange.toStatus}`;
      const userIssueUrl = buildUserProjectIssueUrl(userIssueKey);

      const devIssue = await createDevIssue({
        summary: `${userIssueKey} - ${statusChange.toStatus}`,
        description,
        userIssueUrl,
      });

      await createMapping({
        userIssueKey: userIssueKey,
        devIssueKey: devIssue.key,
        userIssueUrl,
        devIssueUrl: buildDevProjectIssueUrl(devIssue.key),
      });

      logger.info(
        { userIssue: userIssueKey, devIssue: devIssue.key },
        'Created Dev issue from status change'
      );
      return;
    }

    if (actions.syncStatus && existingMapping) {
      const targetStatus = getTargetStatus(rule, statusChange);

      // For User->Dev, we assume Dev project relies on standard transitions or specific targetStatus.
      // If we needed dynamic resolution for DEV project, we'd need similar logic. 
      // Current requirement is mostly Dev->User resolution.
      if (targetStatus === 'Resolved') {
        // Keeping legacy check or should we strict check? 
        // User -> Dev usually doesn't "resolve" dev issue in the same way (dev issue might have specific workflow)
        // But if rule says "Resolved", we try specific transition.
        await transitionDevIssueStatus(existingMapping.dev_issue_key, targetStatus);
      } else {
        await transitionDevIssueStatus(existingMapping.dev_issue_key, targetStatus);
      }

      if (actions.addComment && actions.commentTemplate) {
        const comment = renderCommentTemplate(
          actions.commentTemplate,
          userIssueKey,
          existingMapping.dev_issue_key
        );
        await commentUserIssue(userIssueKey, comment);
      }

      logger.info(
        { userIssue: userIssueKey, devIssue: existingMapping.dev_issue_key, status: targetStatus },
        'Synced status change to Dev project'
      );
    }
  } else {
    const devIssueKey = statusChange.issueKey;
    const mapping = await getMappingByDevKey(devIssueKey);

    if (!mapping) {
      logger.debug(
        { devIssue: devIssueKey },
        'Skipping Dev status change: no mapping exists'
      );
      return;
    }

    const userIssueKey = mapping.user_issue_key;

    if (actions.syncStatus) {
      const targetStatus = getTargetStatus(rule, statusChange);
      const categoryMap = await getStatusCategoryMap(); // Fetch fresh map

      if (isResolutionStatus(targetStatus, categoryMap)) {
        await resolveUserIssue(userIssueKey, false, targetStatus);
      } else {
        await transitionUserIssueStatus(userIssueKey, targetStatus);
      }

      if (actions.addComment && actions.commentTemplate) {
        const comment = renderCommentTemplate(
          actions.commentTemplate,
          devIssueKey,
          userIssueKey
        );
        await commentUserIssue(userIssueKey, comment);
      }

      logger.info(
        { devIssue: devIssueKey, userIssue: userIssueKey, status: targetStatus },
        'Synced status change to User project'
      );
    }
  }
};
