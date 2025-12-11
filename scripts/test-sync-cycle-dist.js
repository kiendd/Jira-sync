// Test runner for sync cycle using built JS (dist).
// Defaults to 1-minute interval; set MONITOR_ISSUE_KEY to log which User Project issue you watch.

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const promptMonitorIssue = async () => {
  const rl = readline.createInterface({ input, output });
  const answer = (await rl.question('User Project issue key to monitor (optional): ')).trim();
  rl.close();
  return answer || undefined;
};

let monitorIssueKey = process.env.MONITOR_ISSUE_KEY;
if (!monitorIssueKey) {
  monitorIssueKey = await promptMonitorIssue();
}

process.env.SYNC_INTERVAL_MINUTES = process.env.SYNC_INTERVAL_MINUTES || '0.1667';

const distBase = path.join(__dirname, '..', 'dist');
const { logger, config } = await import(path.join(distBase, 'config', 'index.js'));
const { connectDb } = await import(path.join(distBase, 'db', 'index.js'));
const { runSyncCycle } = await import(path.join(distBase, 'scheduler.js'));

const interval = Number.isFinite(Number(process.env.SYNC_INTERVAL_MINUTES))
  ? Number(process.env.SYNC_INTERVAL_MINUTES)
  : 0.1667;
const intervalMs = Math.max(10_000, interval * 60_000);

logger.info({ intervalMs, monitorIssueKey, jiraBase: config.jira.baseUrl }, 'Starting test sync runner');
console.log(`[test-sync] Interval: ${Math.round(intervalMs / 1000)}s | Monitor: ${monitorIssueKey || 'n/a'} | Jira: ${config.jira.baseUrl}`);

await connectDb();

const runOnce = async () => {
  try {
    console.log(`[test-sync] ▶ Triggering sync...`);
    await runSyncCycle();
    console.log(`[test-sync] ✔ Completed sync`);
  } catch (err) {
    const status = (err && err.response && err.response.status) || '';
    const msg = (err && err.message) || String(err);
    console.error(`[test-sync] ✖ Sync failed ${status ? `(HTTP ${status})` : ''}: ${msg}`);
  }
};

await runOnce();

const timer = setInterval(runOnce, intervalMs);
// Allow clean exit on Ctrl+C
process.on('SIGINT', () => {
  clearInterval(timer);
  logger.info('Test sync runner stopped');
  process.exit(0);
});
