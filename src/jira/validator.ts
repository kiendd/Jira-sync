import { jiraClient } from './client.js';
import { logger } from '../config/index.js';
import { SyncFlowConfigDoc } from '../db/models.js';

export class JiraValidator {
    async validateConfiguration(config: SyncFlowConfigDoc): Promise<boolean> {
        try {
            logger.info('Validating Jira connection and configuration...');

            // 1. Validate Connection & Auth
            await this.validateAuth();
            logger.info('Jira authentication successful');

            // 2. Validate Projects
            await this.validateProject(config.userProjectKey, 'User');
            await this.validateProject(config.devProjectKey, 'Dev');

            // 3. Validate Statuses (Optional but recommended)
            // Checks if statuses defined in rules exist in the projects
            // We gather all source statuses from rules matching user/dev project logic
            const userStatuses = new Set<string>();
            const devStatuses = new Set<string>();

            for (const rule of config.rules) {
                if (!rule.enabled) continue;

                // Map source status to project
                // user_to_dev: source is User
                // dev_to_user: source is Dev
                // both: source checks both?? (Usually sync logic is specific, assuming 'user' -> 'dev' means user status triggers dev change)

                if (rule.syncDirection === 'user_to_dev' || rule.syncDirection === 'both') {
                    userStatuses.add(rule.sourceStatus);
                }
                if (rule.syncDirection === 'dev_to_user' || rule.syncDirection === 'both') {
                    devStatuses.add(rule.sourceStatus);
                }

                if (rule.actions?.targetStatus) {
                    if (rule.targetProject === 'dev') {
                        devStatuses.add(rule.actions.targetStatus);
                    } else {
                        userStatuses.add(rule.actions.targetStatus);
                    }
                }
            }

            await this.validateProjectStatuses(config.userProjectKey, Array.from(userStatuses));
            await this.validateProjectStatuses(config.devProjectKey, Array.from(devStatuses));

            logger.info('Jira configuration validation passed');
            return true;
        } catch (err) {
            logger.error({ err }, 'Jira validation failed');
            return false;
        }
    }

    private async validateAuth(): Promise<void> {
        try {
            const user = await jiraClient.getCurrentUser();
            if (!user) {
                throw new Error('Could not retrieve current user');
            }
        } catch (e: any) {
            throw new Error(`Authentication failed: ${e.message}`);
        }
    }

    private async validateProject(key: string, type: string): Promise<void> {
        try {
            await jiraClient.getProject(key);
            logger.info({ project: key, type }, `${type} project exists`);
        } catch (e: any) {
            throw new Error(`${type} project "${key}" not found or inaccessible: ${e.message}`);
        }
    }

    private async validateProjectStatuses(projectKey: string, requiredStatuses: string[]): Promise<void> {
        if (requiredStatuses.length === 0) return;

        try {
            const statuses = await jiraClient.getProjectStatuses(projectKey);
            // statuses structure depends on Jira API. 
            // getAllStatuses returns IssueTypeWithStatus[], we need to flatten
            const availableStatuses = new Set<string>();

            statuses.forEach((issueType: any) => {
                issueType.statuses.forEach((s: any) => availableStatuses.add(s.name.toLowerCase()));
            });

            const missing = requiredStatuses.filter(s => !availableStatuses.has(s.toLowerCase()));

            if (missing.length > 0) {
                logger.warn({ project: projectKey, missingStatuses: missing }, 'Some statuses defined in rules were not found in the project. This might cause sync failures.');
                // We warn instead of failing strictly for statuses, as permissions might hide some, or they might be valid but not visible in all issue types.
            }
        } catch (e: any) {
            logger.warn({ project: projectKey, err: e.message }, 'Failed to validate project statuses (skipping status check)');
        }
    }
}

export const jiraValidator = new JiraValidator();
