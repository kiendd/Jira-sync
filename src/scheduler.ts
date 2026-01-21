import cron from 'node-cron';
import { logger, config } from './config/index.js';
import { syncUserProjectToDevProject } from './sync/sync-user-to-dev.js';
import { syncDevProjectToUserProject } from './sync/sync-dev-to-user.js';
import { getLastSync, updateLastSync } from './db/repo.js';
import { monitorUserProjectStatuses } from './sync/monitor-user-project-status.js';
import { syncConfigLoader } from './sync/config-loader.js';

export const runSyncCycle = async (): Promise<void> => {
  const lastSync = await getLastSync();
  const syncConfig = syncConfigLoader.loadConfig();

  await syncUserProjectToDevProject(lastSync, syncConfig);
  await syncDevProjectToUserProject(lastSync, syncConfig);
  await monitorUserProjectStatuses();
  await updateLastSync(new Date());
};

export const startScheduler = (): void => {
  const interval = Number.isFinite(config.syncIntervalMinutes) && config.syncIntervalMinutes > 0
    ? config.syncIntervalMinutes
    : 5;
  const cronExpr = `*/${interval} * * * *`;

  logger.info({ cronExpr }, 'Starting scheduler');

  runSyncCycle().catch((err) => logger.error({ err }, 'Initial sync failed'));
  cron.schedule(cronExpr, () => {
    runSyncCycle().catch((err) => logger.error({ err }, 'Scheduled sync failed'));
  });
};
