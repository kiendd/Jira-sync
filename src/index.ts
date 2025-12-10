import { logger } from './config/index.js';
import { startScheduler } from './scheduler.js';
import { connectDb } from './db/index.js';

const start = async () => {
  try {
    logger.info('Starting Jira sync service');
    await connectDb();
    startScheduler();
  } catch (err) {
    logger.error({ err }, 'Failed to start service');
    process.exit(1);
  }
};

start();
