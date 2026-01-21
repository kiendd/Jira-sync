import { logger, config } from '../config/index.js';
import { connectDb } from '../db/index.js';
import { startScheduler } from '../scheduler.js';
import fs from 'fs';
import { SyncFlowConfigDoc, JiraConfig } from '../db/models.js';

const sendHeartbeat = (): void => {
  process.send?.({ type: 'heartbeat' });
};

const isWorker = process.env.WORKER_NAME !== undefined;

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

const loadWorkerConfig = (): SyncFlowConfigDoc | null => {
  const configPath = process.env.WORKER_CONFIG_PATH;
  if (!configPath) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const loadedConfig = JSON.parse(content) as SyncFlowConfigDoc;
    logger.info({ file: configPath, name: loadedConfig.name }, 'Worker loaded config');

    if (loadedConfig.jira) {
      loadedConfig.jira.baseUrl = normalizeBaseUrl(loadedConfig.jira.baseUrl);
    }

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
  if (workerConfig) {
    applyConfigToGlobal(workerConfig);
  }

  try {
    logger.info({ worker: workerName, databaseName, hasConfig: !!workerConfig }, 'Worker starting');

    await connectDb();
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
