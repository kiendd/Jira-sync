import cron from 'node-cron';
import { logger, config } from './config/index.js';
import { syncUserProjectToDevProject, syncUserStatusChangesToDevProject } from './sync/sync-user-to-dev.js';
import { syncDevProjectToUserProject, syncDevStatusChangesToUserProject } from './sync/sync-dev-to-user.js';
import { getLastSync, updateLastSync, getSyncState, markInitialSyncCompleted } from './db/repo.js';
import { monitorAllProjects } from './sync/monitor-all-projects.js';
import { syncConfigLoader } from './sync/config-loader.js';
import { SyncFlowConfigDoc } from './db/models.js';
import { SyncMetrics } from './sync/audit-logger.js';

export const runSyncCycle = async (metricConfig: SyncFlowConfigDoc): Promise<void> => {
  const syncConfig = metricConfig;
  const workerName = syncConfig.name || 'default';
  const metrics = new SyncMetrics(workerName);

  const syncState = await getSyncState(workerName);
  const lastSync = syncState?.last_sync ?? null;
  const initialSyncDone = syncState?.initial_sync_completed ?? false;

  const initialSyncEnabled = syncConfig.initialSyncEnabled ?? true;
  const doFullSync = initialSyncEnabled && !lastSync && !initialSyncDone;

  if (doFullSync) {
    logger.info({ worker: workerName }, 'Running initial full sync');
  } else if (!lastSync && initialSyncDone) {
    logger.warn({ worker: workerName }, 'Last sync state lost, using current time for incremental sync');
  }

  try {
    const effectiveLastSync = doFullSync ? null : (lastSync || new Date());

    await syncUserProjectToDevProject(effectiveLastSync, syncConfig, doFullSync);
    await syncDevProjectToUserProject(effectiveLastSync, syncConfig, doFullSync);

    const statusChanges = await monitorAllProjects(doFullSync, metrics);

    if (statusChanges.length > 0) {
      await syncUserStatusChangesToDevProject(statusChanges, syncConfig);
      await syncDevStatusChangesToUserProject(statusChanges, syncConfig);
    }

    await updateLastSync(new Date(), workerName);

    if (doFullSync) {
      await markInitialSyncCompleted(workerName);
      logger.info({ worker: workerName }, 'Initial sync completed');
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    metrics.incrementErrors(errorMessage);
    logger.error({ err, worker: workerName }, 'Sync cycle failed');
    throw err;
  } finally {
    metrics.complete();
  }
};

export const startScheduler = (workerConfig: SyncFlowConfigDoc): void => {
  let interval: number;

  if (workerConfig?.syncIntervalMinutes !== undefined && workerConfig.syncIntervalMinutes > 0) {
    interval = workerConfig.syncIntervalMinutes;
  } else if (Number.isFinite(config.syncIntervalMinutes) && config.syncIntervalMinutes > 0) {
    interval = config.syncIntervalMinutes;
  } else {
    interval = 5;
  }

  const cronExpr = `*/${interval} * * * *`;

  logger.info({ cronExpr, workerConfig }, 'Starting scheduler');

  runSyncCycle(workerConfig).catch((err) => logger.error({ err }, 'Initial sync failed'));
  cron.schedule(cronExpr, () => {
    runSyncCycle(workerConfig).catch((err) => logger.error({ err }, 'Scheduled sync failed'));
  });
};
