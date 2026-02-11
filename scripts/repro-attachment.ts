
import { getUpdatedUserProjectIssues } from '../src/jira/user-project.js';
import { config, logger } from '../src/config/index.js';
import { jiraClient } from '../src/jira/client.js';

const buildAuthHeader = (): Record<string, string> => {
    if (config.jira.authType === 'pat') {
        return { Authorization: `Bearer ${config.jira.apiToken}` };
    }
    const token = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
    return { Authorization: `Basic ${token}` };
};

const testDownload = async () => {
    try {
        console.log('Fetching issues...');
        const issues = await getUpdatedUserProjectIssues(null, true);
        console.log(`Found ${issues.length} issues.`);

        const issueWithAttachment = issues.find(i => i.fields.attachment && i.fields.attachment.length > 0);

        if (!issueWithAttachment) {
            console.log('No issues with attachments found.');
            return;
        }

        console.log(`Found issue with attachment: ${issueWithAttachment.key}`);
        const att = issueWithAttachment.fields.attachment[0];
        console.log(`Attempting to download: ${att.filename} from ${att.content}`);

        const headers = buildAuthHeader();
        // Simulate the logic in sync-user-to-dev.ts
        const resp = await fetch(att.content, { headers, redirect: 'manual' }); // Check if redirect is the issue by disabling auto follow, or just let it follow and see 404/403

        console.log(`Response Status: ${resp.status}`);
        console.log(`Response Headers:`, resp.headers);

        if (resp.status >= 300 && resp.status < 400) {
            console.log('Redirect location:', resp.headers.get('location'));
        }

        if (!resp.ok) {
            console.error('Download failed!');

            // Try with axios or jira client if possible to see if it works
            console.log('Trying with jira client request...');
            // jira.js doesn't have a direct download helper exposed easily on the instance without using the private client
            // but let's try a standard fetch with redirect: follow
            const resp2 = await fetch(att.content, { headers });
            console.log(`Response 2 (follow redirects) Status: ${resp2.status}`);
        } else {
            console.log('Download successful!');
            const buf = await resp.arrayBuffer();
            console.log(`Downloaded ${buf.byteLength} bytes.`);
        }

    } catch (error) {
        console.error('Error:', error);
    }
};

testDownload();
