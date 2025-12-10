import { jiraClient } from '../src/jira/client.js';
import { config, logger } from '../src/config/index.js';

const DEFAULT_LIMIT = 20;

const parseLimit = (): number | null => {
  const arg = process.argv[2];
  if (arg && arg.toLowerCase() === 'all') {
    return null;
  }
  const limit = arg ? Number(arg) : DEFAULT_LIMIT;
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
};

const main = async (): Promise<void> => {
  const limit = parseLimit();
  try {
    const issues = await jiraClient.searchIssues({
      jql: `project = ${config.jira.userProjectKey} ORDER BY updated DESC`,
      fields: ['summary', 'status', 'assignee', 'updated'],
    });

    const sliced = limit === null ? issues : issues.slice(0, limit);
    const label = limit === null ? 'showing all' : `showing ${sliced.length}/${issues.length}`;
    console.log(`Project ${config.jira.userProjectKey} issues (${label}):`);
    for (const issue of sliced) {
      const status = issue.fields?.status?.name ?? 'Unknown';
      const assignee = issue.fields?.assignee?.displayName ?? 'Unassigned';
      const summary = issue.fields?.summary ?? '';
      const updated = issue.fields?.updated ?? '';
      console.log(`${issue.key} | ${status} | ${assignee} | ${updated} | ${summary}`);
    }
  } catch (err) {
    logger.error({ err }, 'Failed to list user project issues');
    process.exit(1);
  }
};

main();
