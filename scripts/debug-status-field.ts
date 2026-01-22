import { jiraClient } from '../src/jira/client.js';
import { logger } from '../src/config/index.js';

const main = async () => {
    try {
        // Search for one issue in USER project
        // We rely on defaults or env vars for keys. 
        // Note: we need to ensure config is loaded. 
        // Since src/jira/client.ts imports config, and config imports dotenv, it should be fine IF .env is correct.
        // But we know config loading is buggy, so we might need to manually set it or rely on the fix being applied?
        // Wait, the fix isn't applied yet. I should manually populate config if needed or rely on hardcoded for test.
        // Actually, let's just use the client directly and see what happens.

        // Manually populate config because src/config/index.ts is buggy
        if (process.env.JIRA_BASE_URL) config.jira.baseUrl = process.env.JIRA_BASE_URL;
        if (process.env.JIRA_EMAIL) config.jira.email = process.env.JIRA_EMAIL;
        if (process.env.JIRA_API_TOKEN) config.jira.apiToken = process.env.JIRA_API_TOKEN;
        if (process.env.JIRA_AUTH_TYPE) config.jira.authType = process.env.JIRA_AUTH_TYPE as any;

        console.log('Searching for issues...');
        const userProjectKey = process.env.USER_PROJECT_KEY || 'SNX';
        const issues = await jiraClient.searchIssues({
            jql: `project = ${userProjectKey}`,
            fields: ['status'], // Request status field
        });

        if (issues.length > 0) {
            const issue = issues[0];
            console.log('Issue Key:', issue.key);
            console.log('Status Field:', JSON.stringify(issue.fields.status, null, 2));
        } else {
            console.log('No issues found.');
        }

    } catch (err) {
        console.error('Error:', err);
    }
};

main();
