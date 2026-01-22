import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { SyncFlowConfigDoc, SyncRule } from '../db/models.js';
import { logger } from '../config/index.js';

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

export const findMatchingRule = (
  rules: SyncRule[],
  sourceStatus: string,
  direction: 'user_to_dev' | 'dev_to_user'
): SyncRule | null => {
  const normalizedStatus = typeof sourceStatus === 'string' ? sourceStatus.trim() : '';

  for (const rule of rules) {
    if (!rule.enabled) {
      logger.debug({ ruleId: rule.id, sourceStatus: rule.sourceStatus, direction: rule.syncDirection, enabled: rule.enabled }, 'Rule disabled, skipping');
      continue;
    }

    const normalizedRuleStatus = rule.sourceStatus.trim();
    const statusMatches = normalizedRuleStatus === normalizedStatus;

    if (!statusMatches) {
      continue;
    }

    const directionMatches =
      rule.syncDirection === 'both' ||
      (direction === 'user_to_dev' && rule.syncDirection === 'user_to_dev') ||
      (direction === 'dev_to_user' && rule.syncDirection === 'dev_to_user');

    if (!directionMatches) {
      continue;
    }

    logger.info({ ruleId: rule.id, sourceStatus: rule.sourceStatus, direction: rule.syncDirection }, 'Found matching rule');
    return rule;
  }

  logger.debug({ sourceStatus: normalizedStatus, direction, rulesCount: rules.length }, 'No matching rule found');
  return null;
};

export interface SyncPairConfig {
  name: string;
  configPath: string;
  config: SyncFlowConfigDoc;
}

const CONFIG_DIR = process.env.CONFIG_DIR || './config';

interface ConfigValidationError {
  field: string;
  reason: string;
}

const validateConfig = (cfg: SyncFlowConfigDoc, filePath: string): ConfigValidationError[] => {
  const errors: ConfigValidationError[] = [];

  if (!cfg.name || cfg.name.trim() === '') {
    errors.push({ field: 'name', reason: 'name is required' });
  }

  if (!cfg.jira?.baseUrl || cfg.jira.baseUrl.trim() === '') {
    errors.push({ field: 'jira.baseUrl', reason: 'jira.baseUrl is required' });
  }

  if (!cfg.jira?.apiToken || cfg.jira.apiToken.trim() === '') {
    errors.push({ field: 'jira.apiToken', reason: 'jira.apiToken is required' });
  }

  if (cfg.jira?.authType !== 'pat' && (!cfg.jira?.email || cfg.jira.email.trim() === '')) {
    errors.push({ field: 'jira.email', reason: 'jira.email is required for basic auth' });
  }

  if (!cfg.userProjectKey || cfg.userProjectKey.trim() === '') {
    errors.push({ field: 'userProjectKey', reason: 'userProjectKey is required' });
  }

  if (!cfg.devProjectKey || cfg.devProjectKey.trim() === '') {
    errors.push({ field: 'devProjectKey', reason: 'devProjectKey is required' });
  }

  return errors;
};

const loadConfigFromFile = (filePath: string): SyncFlowConfigDoc | null => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content) as SyncFlowConfigDoc;

    if (config.jira) {
      config.jira.baseUrl = normalizeBaseUrl(config.jira.baseUrl);
    }

    const validationErrors = validateConfig(config, filePath);
    if (validationErrors.length > 0) {
      logger.error({ file: filePath, errors: validationErrors }, 'Config validation failed');
      return null;
    }

    logger.info({ file: filePath, name: config.name }, 'Loaded sync config');
    return config;
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
  loadConfigs(): SyncPairConfig[] {
    return loadConfigsFromDirectory();
  }
}

export const syncConfigLoader = new SyncConfigLoader();
