import { logger, config } from '../config/index.js';
import { connectDb } from '../db/index.js';
import { startScheduler } from '../scheduler.js';
import fs from 'fs';
import { SyncFlowConfigDoc } from '../db/models.js';

const sendHeartbeat = (): void => {
  process.send?.({ type: 'heartbeat' });
};

const isWorker = process.env.WORKER_NAME !== undefined;

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

const validateWorkerConfig = (cfg: SyncFlowConfigDoc): string[] => {
  const errors: string[] = [];

  if (!cfg.jira?.baseUrl) errors.push('jira.baseUrl');
  if (!cfg.jira?.apiToken) errors.push('jira.apiToken');
  if (!cfg.jira?.email && cfg.jira?.authType !== 'pat') errors.push('jira.email');
  if (!cfg.userProjectKey) errors.push('userProjectKey');
  if (!cfg.devProjectKey) errors.push('devProjectKey');

  return errors;
};

const loadWorkerConfig = (): SyncFlowConfigDoc | null => {
  const configPath = process.env.WORKER_CONFIG_PATH;
  if (!configPath) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const loadedConfig = JSON.parse(content) as SyncFlowConfigDoc;

    if (loadedConfig.jira) {
      loadedConfig.jira.baseUrl = normalizeBaseUrl(loadedConfig.jira.baseUrl);
    }

    const validationErrors = validateWorkerConfig(loadedConfig);
    if (validationErrors.length > 0) {
      logger.error({ file: configPath, missingFields: validationErrors }, 'Worker config validation failed');
      return null;
    }

    logger.info({ file: configPath, name: loadedConfig.name }, 'Worker loaded config');
    return loadedConfig;
  } catch (err) {
    logger.error({ file: configPath, err }, 'Failed to load worker config');
    return null;
  }
};

const applyConfigToGlobal = (workerConfig: SyncFlowConfigDoc): void => {
  if (workerConfig.jira) {
    config.jira.baseUrl = workerConfig.jira.baseUrl;
    config.jira.email = workerConfig.jira.email || '';
    config.jira.apiToken = workerConfig.jira.apiToken;
    config.jira.authType = workerConfig.jira.authType;
  }

  if (workerConfig.userProjectKey) {
    config.jira.userProjectKey = workerConfig.userProjectKey;
  }

  if (workerConfig.devProjectKey) {
    config.jira.devProjectKey = workerConfig.devProjectKey;
  }

  if (workerConfig.syncIntervalMinutes !== undefined) {
    config.syncIntervalMinutes = workerConfig.syncIntervalMinutes;
  }

  logger.info({
    baseUrl: config.jira.baseUrl,
    userProjectKey: config.jira.userProjectKey,
    devProjectKey: config.jira.devProjectKey,
    syncIntervalMinutes: config.syncIntervalMinutes,
  }, 'Applied worker config to global');
};

const runWorker = async () => {
  const workerName = process.env.WORKER_NAME || 'worker';
  const databaseName = process.env.DATABASE_NAME || workerName;

  const workerConfig = loadWorkerConfig();
  if (!workerConfig) {
    logger.error({ worker: workerName }, 'Worker failed to load config');
    process.exit(1);
  }

  applyConfigToGlobal(workerConfig);

  try {
    logger.info({ worker: workerName, databaseName }, 'Worker starting');

    // Validate configuration before starting
    const { jiraValidator } = await import('../jira/validator.js');
    const isValid = await jiraValidator.validateConfiguration(workerConfig);

    if (!isValid) {
      logger.error({ worker: workerName }, 'Worker config validation failed. Exiting.');
      process.exit(1);
    }

    await connectDb(databaseName);
    startScheduler(workerConfig);

    logger.info({ worker: workerName }, 'Worker started successfully');

    sendHeartbeat();
    setInterval(sendHeartbeat, 30000);

  } catch (err) {
    logger.error({ err, worker: workerName }, 'Worker failed to start');
    process.exit(1);
  }
};

if (isWorker) {
  runWorker();
}

export { sendHeartbeat };
