import { logger, config } from './config/index.js';
import { syncConfigLoader } from './sync/config-loader.js';
import { processManager } from './sync/process-manager.js';
import http from 'http';

const isWorker = process.env.WORKER_NAME !== undefined;

const startMainProcess = async () => {
  try {
    logger.info('Starting Jira sync service (main process)');

    const configs = syncConfigLoader.loadConfigs();

    if (configs.length === 0) {
      logger.error({
        configDir: config.configDir,
      }, `No configuration files found in ${config.configDir}/

To run the service, you must create at least one JSON config file.

Example config/sync-ab.json:
{
  "name": "sync-ab",
  "jira": {
    "baseUrl": "https://your-domain.atlassian.net",
    "email": "bot@your-domain.com",
    "apiToken": "your-api-token",
    "authType": "pat"
  },
  "userProjectKey": "USER-A",
  "devProjectKey": "DEV-A",
  "syncIntervalMinutes": 5
}

See DEPLOY.md for detailed configuration instructions.`);
      process.exit(1);
    }

    logger.info({ count: configs.length }, 'Starting workers for sync configurations');
    processManager.startWorkers(configs);

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

    healthServer.listen(config.port, '0.0.0.0', () => {
      logger.info({ port: config.port }, 'Health check server started');
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
