import { config } from '../config/index.js';
import { SyncFlowConfigDoc, SyncRule, SyncDirection } from '../db/models.js';
import { logger } from '../config/index.js';

export const getDefaultConfig = (): SyncFlowConfigDoc => ({
  name: 'default',
  description: 'Default sync flow configuration - maintains current behavior',
  userProjectKey: config.jira.userProjectKey,
  devProjectKey: config.jira.devProjectKey,
  defaultBehavior: {
    syncAttachments: true,
    addCrossLinks: true,
    onlyOnStatusChange: true,
    skipIntermediateStatuses: true,
  },
  rules: [
    {
      id: 'user-will-do',
      sourceStatus: 'Will Do',
      targetProject: 'dev',
      syncDirection: 'user_to_dev',
      enabled: true,
      priority: 1,
      description: 'When User issue transitions to "Will Do" and no Dev issue exists → Create new Dev issue',
      conditions: {
        requireMapping: false,
      },
      actions: {
        createIssue: true,
        syncAttachments: true,
        addCrossLink: true,
        addComment: true,
        commentTemplate: 'Đã tạo Dev Issue: ${targetKey}',
      },
    },
    {
      id: 'user-reopened',
      sourceStatus: 'Reopened',
      targetProject: 'dev',
      syncDirection: 'user_to_dev',
      enabled: true,
      priority: 2,
      description: 'When User issue transitions to "Reopened" → Transition Dev issue to "Reopened"',
      conditions: {
        requireMapping: true,
      },
      actions: {
        syncStatus: true,
        targetStatus: 'Reopened',
      },
    },
    {
      id: 'dev-in-progress',
      sourceStatus: 'In Progress',
      targetProject: 'user',
      syncDirection: 'dev_to_user',
      enabled: true,
      priority: 3,
      description: 'When Dev issue transitions to "In Progress" → Transition User issue to "In Progress"',
      conditions: {
        requireMapping: true,
        onStatusChange: true,
      },
      actions: {
        syncStatus: true,
        targetStatus: 'In Progress',
      },
    },
    {
      id: 'dev-closed',
      sourceStatus: 'Closed',
      targetProject: 'user',
      syncDirection: 'dev_to_user',
      enabled: true,
      priority: 4,
      description: 'When Dev issue transitions to "Closed" → Resolve User issue + add comment',
      conditions: {
        requireMapping: true,
        onStatusChange: true,
      },
      actions: {
        syncStatus: true,
        targetStatus: 'Resolved',
        addCrossLink: true,
        addComment: true,
        commentTemplate: 'Lỗi đã được xử lý tại issue ${sourceKey}',
      },
    },
    {
      id: 'dev-cancelled',
      sourceStatus: 'Cancelled',
      targetProject: 'user',
      syncDirection: 'dev_to_user',
      enabled: true,
      priority: 5,
      description: 'When Dev issue transitions to "Cancelled" → Transition User issue to "Cancelled"',
      conditions: {
        requireMapping: true,
        onStatusChange: true,
      },
      actions: {
        syncStatus: true,
        targetStatus: 'Cancelled',
      },
    },
    {
      id: 'dev-reopened',
      sourceStatus: 'Reopened',
      targetProject: 'user',
      syncDirection: 'dev_to_user',
      enabled: true,
      priority: 6,
      description: 'When Dev issue transitions to "Reopened" → Transition User issue to "Reopened" + comment',
      conditions: {
        requireMapping: true,
        onStatusChange: true,
      },
      actions: {
        syncStatus: true,
        targetStatus: 'Reopened',
        addComment: true,
        commentTemplate: 'Issue DEV ${sourceKey} đã được Reopened, cần xử lý lại',
      },
    },
  ],
});

export const findMatchingRule = (
  rules: SyncRule[],
  sourceStatus: string,
  direction: 'user_to_dev' | 'dev_to_user'
): SyncRule | null => {
  const normalizedStatus = typeof sourceStatus === 'string' ? sourceStatus.trim() : '';

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const statusMatches = rule.sourceStatus.trim() === normalizedStatus;
    if (!statusMatches) continue;

    const directionMatches =
      rule.syncDirection === 'both' ||
      (direction === 'user_to_dev' && rule.syncDirection === 'user_to_dev') ||
      (direction === 'dev_to_user' && rule.syncDirection === 'dev_to_user');

    if (directionMatches) {
      return rule;
    }
  }

  return null;
};

export class SyncConfigLoader {
  private defaultConfig: SyncFlowConfigDoc;

  constructor() {
    this.defaultConfig = getDefaultConfig();
  }

  loadConfig(): SyncFlowConfigDoc {
    return this.defaultConfig;
  }

  getDefaultConfig(): SyncFlowConfigDoc {
    return this.defaultConfig;
  }
}

export const syncConfigLoader = new SyncConfigLoader();
