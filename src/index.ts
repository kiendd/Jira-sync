import { logger } from './config/index.js';
import { syncConfigLoader } from './sync/config-loader.js';
import { processManager } from './sync/process-manager.js';
import http from 'http';

const isWorker = process.env.WORKER_NAME !== undefined;

const startMainProcess = async () => {
  try {
    logger.info('Starting Jira sync service (main process)');

    const configs = syncConfigLoader.loadConfigs();

    if (configs.length === 0) {
      logger.warn('No sync configurations found. Please add config files to the config directory.');
      logger.info('Example: config/sync-ab.json, config/sync-cd.json');
    } else {
      logger.info({ count: configs.length }, 'Starting workers for sync configurations');
      processManager.startWorkers(configs);
    }

    const healthServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        const workerStatuses = processManager.getWorkerStatus();
        const allHealthy = workerStatuses.every(w => w.status === 'running');
        
        res.writeHead(allHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: allHealthy ? 'healthy' : 'degraded',
          workers: workerStatuses,
          timestamp: new Date().toISOString(),
        }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    const PORT = Number(process.env.PORT || 3000);
    healthServer.listen(PORT, '0.0.0.0', () => {
      logger.info({ port: PORT }, 'Health check server started');
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down');
      processManager.stopAll();
      healthServer.close();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down');
      processManager.stopAll();
      healthServer.close();
      process.exit(0);
    });

  } catch (err) {
    logger.error({ err }, 'Failed to start service');
    process.exit(1);
  }
};

if (!isWorker) {
  startMainProcess();
}
