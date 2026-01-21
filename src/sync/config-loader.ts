import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { SyncFlowConfigDoc, SyncRule, JiraConfig } from '../db/models.js';
import { logger } from '../config/index.js';

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');
const optionalEnv = (key: string): string | undefined => {
  const value = process.env[key];
  return value ? value.trim() : undefined;
};

const applyEnvFallback = (loadedConfig: SyncFlowConfigDoc): SyncFlowConfigDoc => {
  const authTypeRaw = optionalEnv('JIRA_AUTH_TYPE')?.toLowerCase();
  const authType = authTypeRaw === 'pat' ? 'pat' : 'basic';

  const jiraBase: JiraConfig = {
    baseUrl: loadedConfig.jira?.baseUrl || optionalEnv('JIRA_BASE_URL') || '',
    apiToken: loadedConfig.jira?.apiToken || optionalEnv('JIRA_API_TOKEN') || '',
    email: loadedConfig.jira?.email || optionalEnv('JIRA_EMAIL') || (authType === 'basic' ? '' : undefined),
    authType: loadedConfig.jira?.authType || authType,
  };

  const syncIntervalMinutes = loadedConfig.syncIntervalMinutes !== undefined
    ? loadedConfig.syncIntervalMinutes
    : (Number(process.env.SYNC_INTERVAL_MINUTES) || 5);

  return {
    ...loadedConfig,
    jira: jiraBase,
    syncIntervalMinutes,
  };
};

export const getDefaultConfig = (): SyncFlowConfigDoc => {
  const authTypeRaw = optionalEnv('JIRA_AUTH_TYPE')?.toLowerCase();
  const authType = authTypeRaw === 'pat' ? 'pat' : 'basic';

  const defaultConfig: SyncFlowConfigDoc = {
    name: 'default',
    description: 'Default sync flow configuration - maintains current behavior',
    jira: {
      baseUrl: optionalEnv('JIRA_BASE_URL') || '',
      email: optionalEnv('JIRA_EMAIL') || (authType === 'basic' ? '' : undefined),
      apiToken: optionalEnv('JIRA_API_TOKEN') || '',
      authType: authType,
    },
    userProjectKey: config.jira.userProjectKey,
    devProjectKey: config.jira.devProjectKey,
    syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES) || 5,
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
  };
  return defaultConfig;
};

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

export interface SyncPairConfig {
  name: string;
  configPath: string;
  config: SyncFlowConfigDoc;
}

const CONFIG_DIR = process.env.CONFIG_DIR || './config';

const loadConfigFromFile = (filePath: string): SyncFlowConfigDoc | null => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content) as SyncFlowConfigDoc;
    const configWithFallback = applyEnvFallback(config);
    logger.info({ file: filePath, name: config.name }, 'Loaded sync config');
    return configWithFallback;
  } catch (err) {
    logger.warn({ file: filePath, err }, 'Failed to load config file');
    return null;
  }
};

export const loadConfigsFromDirectory = (): SyncPairConfig[] => {
  const configs: SyncPairConfig[] = [];

  try {
    const dirPath = path.resolve(CONFIG_DIR);
    
    if (!fs.existsSync(dirPath)) {
      logger.warn({ dir: dirPath }, 'Config directory does not exist');
      return configs;
    }

    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'sync-rules.example.json') continue;
      
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile()) {
        const config = loadConfigFromFile(filePath);
        if (config) {
          configs.push({
            name: config.name || file.replace('.json', ''),
            configPath: filePath,
            config,
          });
        }
      }
    }

    logger.info({ count: configs.length, dir: dirPath }, 'Loaded configs from directory');
  } catch (err) {
    logger.error({ err, dir: CONFIG_DIR }, 'Failed to scan config directory');
  }

  return configs;
};

export class SyncConfigLoader {
  private defaultConfig: SyncFlowConfigDoc;

  constructor() {
    this.defaultConfig = getDefaultConfig();
  }

  loadConfig(): SyncFlowConfigDoc {
    return this.defaultConfig;
  }

  loadConfigs(): SyncPairConfig[] {
    return loadConfigsFromDirectory();
  }

  getDefaultConfig(): SyncFlowConfigDoc {
    return this.defaultConfig;
  }
}

export const syncConfigLoader = new SyncConfigLoader();
