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
  getUserProjectStatuses,
} from '../jira/user-project.js';
import { getMappingByDevKey, getDevProjectIssueState, upsertDevProjectIssueState } from '../db/repo.js';
import { descriptionHasLink } from '../jira/description.js';
import { SyncFlowConfigDoc, SyncRule } from '../db/models.js';
import { findMatchingRule } from './config-loader.js';
import { StatusChange } from './issue-state-tracker.js';
import {
  logIssueFetched,
  logIssueProcessed,
  logActionSyncStatus,
  logActionSkipped,
} from './audit-logger.js';

const renderCommentTemplate = (template: string, sourceKey: string, targetKey: string): string => {
  return template.replace(/\$\{sourceKey\}/g, sourceKey).replace(/\$\{targetKey\}/g, targetKey);
};

const shouldSkipStatus = (statusName: string, config: SyncFlowConfigDoc): boolean => {
  const skipIntermediate = config.defaultBehavior?.skipIntermediateStatuses ?? true;
  if (!skipIntermediate) return false;
  // TODO: Maybe make this dynamic too? For now keep 'Done' as hardcoded intermediate if needed
  const intermediateStatuses = ['Done'];
  return intermediateStatuses.includes(statusName);
};

const getStatusCategoryMap = async (): Promise<Map<string, string>> => {
  try {
    const statuses = await getUserProjectStatuses();
    const map = new Map<string, string>();
    // Flatten the response struct: IssueType -> statuses -> name/statusCategory
    statuses.forEach((issueType: any) => {
      issueType.statuses.forEach((s: any) => {
        if (s.name && s.statusCategory?.key) {
          map.set(s.name.toLowerCase(), s.statusCategory.key);
        }
      });
    });
    return map;
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch user project statuses for category check');
    return new Map();
  }
};

const isResolutionStatus = (status: string, categoryMap: Map<string, string>): boolean => {
  const category = categoryMap.get(status.toLowerCase());
  return category === 'done';
};

const executeRuleActions = async (
  issue: any,
  rule: SyncRule,
  mapping: any,
  statusCategoryMap: Map<string, string>
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

    if (isResolutionStatus(targetStatus, statusCategoryMap)) {
      // If target is a resolution status (category 'done'), mark replied
      // and ensure status transition happens if needed
      const isAlreadyResolved = isResolutionStatus(userStatus, statusCategoryMap);
      // Skip status change if already resolved? Or strict match?
      // Strict match is better: if user is 'Closed' but target is 'Resolved', we might want to respect target.
      // However, often any 'done' status is fine. 
      // Existing logic: const skipStatusChange = userStatus === 'Resolved' || userStatus === 'Closed';
      // We'll stick to strict transition unless user is already in that specific status
      await resolveUserIssue(userIssueKey, userStatus === targetStatus, targetStatus);
    } else {
      if (userStatus !== targetStatus) {
        await transitionUserIssueStatus(userIssueKey, targetStatus);
      }
    }

    if (actions.addComment && actions.commentTemplate) {
      const comment = renderCommentTemplate(actions.commentTemplate, issue.key, userIssueKey);
      await commentUserIssue(userIssueKey, comment);
    }

    logActionSyncStatus(
      issue.key,
      issue.fields?.status?.name ?? 'Unknown',
      userIssueKey,
      targetStatus,
      'dev_to_user'
    );

    logIssueProcessed(
      issue.key,
      issue.fields?.summary ?? issue.key,
      'dev',
      issue.fields?.status?.name ?? 'Unknown',
      rule.id ?? rule.sourceStatus,
      'syncStatus',
      userIssueKey,
      true
    );
  }
};

export const syncDevProjectToUserProject = async (
  lastSync: Date | null,
  syncConfig: SyncFlowConfigDoc,
  doFullSync: boolean = false
): Promise<void> => {
  const [issues, statusCategoryMap] = await Promise.all([
    getUpdatedDevProjectIssues(lastSync, doFullSync),
    getStatusCategoryMap()
  ]);

  logger.debug({
    configName: syncConfig.name,
    rulesCount: syncConfig.rules.length,
    rules: syncConfig.rules.map(r => ({ id: r.id, sourceStatus: r.sourceStatus, enabled: r.enabled, direction: r.syncDirection }))
  }, 'Dev sync config loaded');

  for (const issue of issues) {
    const statusName = issue.fields?.status?.name ?? 'Unknown';
    const issueTitle = issue.fields?.summary ?? issue.key;
    const normalizedStatus = typeof statusName === 'string' ? statusName.trim() : '';

    logIssueFetched(
      issue.key,
      issueTitle,
      'dev',
      statusName,
      issue.fields?.updated ?? null
    );

    if (shouldSkipStatus(normalizedStatus, syncConfig)) {
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    const rule = findMatchingRule(syncConfig.rules, normalizedStatus, 'dev_to_user');

    logger.info({
      issue: issue.key,
      status: statusName,
      normalizedStatus,
      ruleFound: !!rule,
      matchedRule: rule ? { id: rule.id, sourceStatus: rule.sourceStatus, direction: rule.syncDirection } : null
    }, 'Rule matching debug');

    if (!rule) {
      logIssueProcessed(
        issue.key,
        issueTitle,
        'dev',
        statusName,
        'none',
        'noRule'
      );
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    const mapping = await getMappingByDevKey(issue.key);
    const devState = await getDevProjectIssueState(issue.key);
    const previousStatus = devState?.status ?? '';
    const isNewIssue = !previousStatus;
    const statusChanged = previousStatus !== normalizedStatus;

    logger.info({
      issueKey: issue.key,
      normalizedStatus,
      previousStatus,
      isNewIssue,
      statusChanged,
      hasMapping: !!mapping,
      mappingUserKey: mapping?.user_issue_key
    }, 'Dev issue sync check');

    const requireMapping = rule.conditions?.requireMapping ?? true;
    if (requireMapping && !mapping) {
      logger.info({ issueKey: issue.key }, 'Skipping: requireMapping but no mapping');
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    const onlyOnChange = rule.conditions?.onStatusChange ?? syncConfig.defaultBehavior?.onlyOnStatusChange ?? true;
    if (onlyOnChange && !statusChanged && !isNewIssue) {
      logger.info({
        issueKey: issue.key,
        onlyOnChange,
        statusChanged,
        isNewIssue
      }, 'Skipping: onlyOnChange and no status change');
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    if (!mapping) {
      logger.info({ issueKey: issue.key }, 'Skipping: no mapping');
      await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
      continue;
    }

    logger.info({
      issueKey: issue.key,
      userIssueKey: mapping.user_issue_key,
      previousStatus,
      currentStatus: normalizedStatus,
      isNewIssue,
      statusChanged
    }, 'Executing status sync action: Dev -> User');

    await executeRuleActions(issue, rule, mapping, statusCategoryMap);

    await upsertDevProjectIssueState({ issueKey: issue.key, status: normalizedStatus });
  }
};

export const syncDevStatusChangesToUserProject = async (
  statusChanges: StatusChange[],
  syncConfig: SyncFlowConfigDoc
): Promise<void> => {
  const devChanges = statusChanges.filter((c) => c.projectType === 'dev');
  if (devChanges.length === 0) return;

  const statusCategoryMap = await getStatusCategoryMap();

  for (const change of devChanges) {
    const rule = findMatchingRule(syncConfig.rules, change.toStatus, 'dev_to_user');

    if (!rule) {
      logActionSkipped(
        change.issueKey,
        'noRule',
        `No rule for status "${change.toStatus}"`
      );
      continue;
    }

    const mapping = await getMappingByDevKey(change.issueKey);

    const requireMapping = rule.conditions?.requireMapping ?? true;
    if (requireMapping && !mapping) {
      logActionSkipped(
        change.issueKey,
        'requireMapping',
        `Rule ${rule.id ?? rule.sourceStatus} requires mapping`
      );
      continue;
    }

    if (rule.actions?.syncStatus && mapping) {
      const userIssueKey = mapping.user_issue_key;
      const targetStatus = rule.actions.targetStatus || rule.sourceStatus;

      if (isResolutionStatus(targetStatus, statusCategoryMap)) {
        // Resolve
        await resolveUserIssue(userIssueKey, false, targetStatus);
      } else {
        await transitionUserIssueStatus(userIssueKey, targetStatus);
      }

      if (rule.actions.addComment && rule.actions.commentTemplate) {
        const comment = renderCommentTemplate(
          rule.actions.commentTemplate,
          change.issueKey,
          userIssueKey
        );
        await commentUserIssue(userIssueKey, comment);
      }

      logActionSyncStatus(
        change.issueKey,
        change.toStatus,
        userIssueKey,
        targetStatus,
        'dev_to_user'
      );

      logIssueProcessed(
        change.issueKey,
        change.issueKey,
        'dev',
        change.toStatus,
        rule.id ?? rule.sourceStatus,
        'syncStatus',
        userIssueKey,
        true
      );
    }
  }
};
