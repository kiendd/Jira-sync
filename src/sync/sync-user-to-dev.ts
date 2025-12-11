import { logger, config } from '../config/index.js';
import {
  getUpdatedUserProjectIssues,
  updateUserProjectDescriptionWithDevLink,
  commentUserIssue,
  buildUserProjectIssueUrl,
} from '../jira/user-project.js';
import { createDevIssue, buildDevProjectIssueUrl } from '../jira/dev-project.js';
import { createMapping, getMappingByUserKey } from '../db/repo.js';
import { descriptionHasIssueLinkForProject } from '../jira/description.js';

export const syncUserProjectToDevProject = async (
  lastSync: Date | null
): Promise<void> => {
  const issues = await getUpdatedUserProjectIssues(lastSync);

  for (const issue of issues) {
    const statusName = issue.fields?.status?.name;
    const description = issue.fields?.description;
    const hasDevLink = descriptionHasIssueLinkForProject(
      description,
      config.jira.devProjectKey
    );

    if (statusName !== 'Will Do') {
      continue;
    }
    if (hasDevLink) {
      continue;
    }
    const existingMapping = await getMappingByUserKey(issue.key);
    if (existingMapping) {
      continue;
    }

    const userIssueUrl = buildUserProjectIssueUrl(issue.key);
    const devIssue = await createDevIssue({
      summary: issue.fields.summary ?? issue.key,
      description: issue.fields.description ?? '',
      severity: issue.fields.severity,
      userIssueUrl,
    });

    await updateUserProjectDescriptionWithDevLink(
      issue.key,
      description,
      devIssue.url
    );

    await createMapping({
      userIssueKey: issue.key,
      devIssueKey: devIssue.key,
      userIssueUrl,
      devIssueUrl: buildDevProjectIssueUrl(devIssue.key),
    });

    await commentUserIssue(issue.key, `Đã tạo Dev Issue: ${devIssue.key}`);
    logger.info(
      { userIssue: issue.key, devIssue: devIssue.key },
      'Synced User project -> Dev project'
    );
  }
};
