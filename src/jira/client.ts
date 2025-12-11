import { Version2Client } from 'jira.js';
type SearchResults = {
  issues?: Array<{ id: string; key: string; fields: Record<string, any> }>;
  total?: number;
};

type TransitionItem = { id?: string; name?: string };
type Transitions = { transitions?: TransitionItem[] };
type JiraIssueModel = { id: string; key: string; fields: Record<string, any> };
type CreatedIssue = { key?: string; id?: string };
type JiraUser = { accountId?: string; key?: string; emailAddress?: string; displayName?: string };
import { config, logger, buildIssueUrl } from '../config/index.js';

export type JiraIssue = {
  id: string;
  key: string;
  fields: Record<string, any>;
};

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
const formatJiraDate = (date: Date): string => {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

class JiraClient {
  private client: Version2Client;

  constructor() {
    const isPat = config.jira.authType === 'pat';
    this.client = new Version2Client({
      host: config.jira.baseUrl,
      authentication: isPat
        ? { oauth2: { accessToken: config.jira.apiToken } }
        : { basic: { email: config.jira.email, apiToken: config.jira.apiToken } },
    });
  }

  async searchIssues(params: {
    jql: string;
    fields?: string[];
    updatedSince?: Date | null;
  }): Promise<JiraIssue[]> {
    const { jql, fields = [], updatedSince } = params;

    let composedJql = jql;
    if (updatedSince) {
      const needle = /order by/i;
      const match = jql.match(needle);
      const updatedClause = `updated >= "${formatJiraDate(updatedSince)}"`;
      if (match) {
        const idx = match.index ?? jql.length;
        composedJql = `${jql.slice(0, idx).trim()} AND ${updatedClause} ${jql.slice(idx)}`;
      } else {
        composedJql = `${jql} AND ${updatedClause}`;
      }
    }
    const maxResults = 50;
    const issues: JiraIssue[] = [];
    let startAt = 0;

    while (true) {
      const res = await this.client.issueSearch.searchForIssuesUsingJql<SearchResults>({
        jql: composedJql,
        fields: fields.length ? fields : undefined,
        startAt,
        maxResults,
      });

      const pageIssues = Array.isArray(res.issues) ? res.issues : null;
      if (!pageIssues) {
        throw new Error(`Unexpected Jira search response: ${JSON.stringify(res)}`);
      }

      const total = typeof res.total === 'number' ? res.total : pageIssues.length;
      issues.push(
        ...pageIssues.map((issue: JiraIssueModel) => ({
          id: issue.id,
          key: issue.key,
          fields: issue.fields as Record<string, any>,
        }))
      );
      if (issues.length >= total || pageIssues.length === 0) {
        break;
      }
      startAt += pageIssues.length;
    }

    logger.info({ jql: composedJql, count: issues.length }, 'Fetched Jira issues');
    return issues;
  }

  async createIssue(fields: Record<string, any>): Promise<{
    key: string;
    id: string;
    url: string;
  }> {
    const res = await this.client.issues.createIssue<CreatedIssue>({
      fields: fields as any,
    });
    if (!res.key || !res.id) {
      throw new Error(`Unexpected Jira create issue response: ${JSON.stringify(res)}`);
    }
    const url = buildIssueUrl(res.key);
    logger.info({ key: res.key }, 'Created Jira issue');
    return { key: res.key, id: res.id, url };
  }

  async updateIssue(issueKey: string, fields: Record<string, any>): Promise<void> {
    await this.client.issues.editIssue({
      issueIdOrKey: issueKey,
      fields: fields as any,
    });
    logger.info({ issueKey }, 'Updated Jira issue');
  }

  async addComment(issueKey: string, body: string): Promise<void> {
    await this.client.issueComments.addComment({
      issueIdOrKey: issueKey,
      comment: body,
    });
    logger.info({ issueKey }, 'Added comment');
  }

  async getIssue(issueKey: string, fields?: string[]): Promise<JiraIssue> {
    const res = await this.client.issues.getIssue<JiraIssueModel>({
      issueIdOrKey: issueKey,
      fields: fields?.length ? fields : undefined,
    });
    return {
      id: res.id,
      key: res.key,
      fields: res.fields as Record<string, any>,
    };
  }

  async transitionIssue(issueKey: string, transitionName: string): Promise<void> {
    const transitionsRes = await this.client.issues.getTransitions<Transitions>({
      issueIdOrKey: issueKey,
    });
    const target = transitionsRes.transitions?.find(
      (t: TransitionItem) => t.name?.toLowerCase() === transitionName.toLowerCase()
    );
    if (!target?.id) {
      logger.warn({ issueKey, transitionName }, 'Transition not found, skipping');
      return;
    }

    await this.client.issues.doTransition({
      issueIdOrKey: issueKey,
      transition: { id: target.id },
    });
    logger.info({ issueKey, transition: transitionName }, 'Transitioned issue');
  }

  async getCurrentUser(): Promise<{
    accountId?: string;
    emailAddress?: string;
    displayName?: string;
  }> {
    const user = await this.client.myself.getCurrentUser<JiraUser>();
    return {
      accountId: (user as any).accountId ?? (user as any).key,
      emailAddress: (user as any).emailAddress,
      displayName: (user as any).displayName,
    };
  }
}

export const jiraClient = new JiraClient();
export { formatJiraDate };
