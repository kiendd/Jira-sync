import mongoose from 'mongoose';
import { config, logger } from '../config/index.js';

let isConnecting = false;

export const connectDb = async (databaseName?: string): Promise<void> => {
  if (mongoose.connection.readyState === 1 || isConnecting) {
    return;
  }
  isConnecting = true;
  try {
    mongoose.set('strictQuery', true);
    const dbName = databaseName || 'jira_sync';
    await mongoose.connect(config.databaseUrl, { dbName });
    logger.info({ databaseName: dbName }, 'Connected to MongoDB');
  } catch (err) {
    logger.error({ err }, 'Failed to connect MongoDB');
    throw err;
  } finally {
    isConnecting = false;
  }
};

process.on('SIGINT', async () => {
  await mongoose.disconnect();
  process.exit(0);
});
