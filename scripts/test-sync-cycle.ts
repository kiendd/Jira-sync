/* Test runner for sync cycle with short interval (default 1 minute).
   Optional: set MONITOR_ISSUE_KEY to log which issue you are watching. */

process.env.SYNC_INTERVAL_MINUTES = process.env.SYNC_INTERVAL_MINUTES || '1';

const monitorIssueKey = process.env.MONITOR_ISSUE_KEY;

const { logger } = await import('../src/config/index.js');
const { connectDb } = await import('../src/db/index.js');
const { runSyncCycle } = await import('../src/scheduler.js');

const intervalMs = Math.max(
  60_000,
  Number.isFinite(Number(process.env.SYNC_INTERVAL_MINUTES))
    ? Number(process.env.SYNC_INTERVAL_MINUTES) * 60_000
    : 60_000
);

logger.info(
  { intervalMs, monitorIssueKey },
  'Starting test sync runner (short interval)'
);

await connectDb();

const runOnce = async () => {
  try {
    logger.info({ monitorIssueKey }, 'Triggering test sync cycle');
    await runSyncCycle();
    logger.info({ monitorIssueKey }, 'Completed test sync cycle');
  } catch (err) {
    logger.error({ err }, 'Test sync cycle failed');
  }
};

// Initial run, then schedule.
await runOnce();
setInterval(runOnce, intervalMs);
