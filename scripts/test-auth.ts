import { jiraClient } from '../src/jira/client.js';
import { config, logger } from '../src/config/index.js';

const main = async (): Promise<void> => {
  try {
    const user = await jiraClient.getCurrentUser();
    console.log('Auth OK', {
      host: config.jira.baseUrl,
      authType: config.jira.authType,
      user,
    });
  } catch (err) {
    logger.error({ err }, 'Auth test failed');
    process.exit(1);
  }
};

main();
