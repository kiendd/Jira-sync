import { logger } from '../config/index.js';
import {
  getUpdatedDevProjectIssues,
  updateDevProjectDescriptionWithUserLink,
} from '../jira/dev-project.js';
import {
  commentUserIssue,
  resolveUserIssue,
  getUserProjectIssue,
  buildUserProjectIssueUrl,
  transitionUserIssueStatus,
} from '../jira/user-project.js';
import { getMappingByDevKey, getDevProjectIssueState, upsertDevProjectIssueState } from '../db/repo.js';
import { descriptionHasLink } from '../jira/description.js';
import { SyncFlowConfigDoc, SyncRule } from '../db/models.js';
import { findMatchingRule } from './config-loader.js';

const renderCommentTemplate = (template: string, sourceKey: string, targetKey: string): string => {
  return template.replace(/\$\{sourceKey\}/g, sourceKey).replace(/\$\{targetKey\}/g, targetKey);
};

const shouldSkipStatus = (statusName: string, config: SyncFlowConfigDoc): boolean => {
  const skipIntermediate = config.defaultBehavior?.skipIntermediateStatuses ?? true;
  if (!skipIntermediate) return false;
  const intermediateStatuses = ['Done'];
  return intermediateStatuses.includes(statusName);
};

const executeRuleActions = async (
  issue: any,
  rule: SyncRule,
  mapping: any
): Promise<void> => {
  const actions = rule.actions;
  if (!actions) return;

  const userIssueKey = mapping.user_issue_key;
  const userIssue = await getUserProjectIssue(userIssueKey);
  const userStatus = userIssue.fields?.status?.name ?? '';

  const userIssueUrl = buildUserProjectIssueUrl(userIssueKey);

  if (actions.addCrossLink) {
    const hasUserIssueLink = descriptionHasLink(
      issue.fields?.description,
      userIssueUrl
    );
    if (!hasUserIssueLink) {
      await updateDevProjectDescriptionWithUserLink(
        issue.key,
        issue.fields?.description,
        userIssueUrl
      );
    }
  }

  if (actions.syncStatus) {
    const targetStatus = actions.targetStatus || rule.sourceStatus;

    if (targetStatus === 'Resolved') {
      const skipStatusChange = userStatus === 'Resolved' || userStatus === 'Closed';
      await resolveUserIssue(userIssueKey, skipStatusChange, 'Resolved');
    } else {
      if (userStatus !== targetStatus) {
        await transitionUserIssueStatus(userIssueKey, targetStatus);
      }
    }

    if (actions.addComment && actions.commentTemplate) {
      const comment = renderCommentTemplate(actions.commentTemplate, issue.key, userIssueKey);
      await commentUserIssue(userIssueKey, comment);
    }

    logger.info(
      { devIssue: issue.key, userIssue: userIssueKey, status: targetStatus },
      'Synced Dev project -> User project'
    );
  }
};

export const syncDevProjectToUserProject = async (
  lastSync: Date | null,
  syncConfig: SyncFlowConfigDoc
): Promise<void> => {
  const issues = await getUpdatedDevProjectIssues(lastSync);

  for (const issue of issues) {
    const statusName = issue.fields?.status?.name;
    const normalizedStatus = typeof statusName === 'string' ? statusName.trim() : '';

    if (shouldSkipStatus(normalizedStatus, syncConfig)) {
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    const rule = findMatchingRule(syncConfig.rules, normalizedStatus, 'dev_to_user');

    if (!rule) {
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    const mapping = await getMappingByDevKey(issue.key);
    const devState = await getDevProjectIssueState(issue.key);
    const previousStatus = devState?.status ?? '';
    const statusChanged = previousStatus !== normalizedStatus;

    const requireMapping = rule.conditions?.requireMapping ?? true;
    if (requireMapping && !mapping) {
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    const onlyOnChange = rule.conditions?.onStatusChange ?? syncConfig.defaultBehavior?.onlyOnStatusChange ?? true;
    if (onlyOnChange && !statusChanged) {
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    if (!mapping) {
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    await executeRuleActions(issue, rule, mapping);

    await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
  }
};
