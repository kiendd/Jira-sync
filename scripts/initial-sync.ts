import mongoose from 'mongoose';
import { logger } from '../src/config/index.js';
import { connectDb } from '../src/db/index.js';
import { updateLastSync } from '../src/db/repo.js';
import { monitorAllProjects } from '../src/sync/monitor-all-projects.js';

const main = async (): Promise<void> => {
  try {
    logger.info('Starting initial one-off sync');
    await connectDb();
    await monitorAllProjects(true);
    await updateLastSync(new Date());
    logger.info('Initial status scan completed');
  } catch (err) {
    logger.error({ err }, 'Initial sync failed');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

main();
