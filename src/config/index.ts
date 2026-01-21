import dotenv from 'dotenv';
import pinoImport from 'pino';

dotenv.config();

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key}`);
  }
  return value.trim();
};

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');
const optionalEnv = (key: string): string | undefined => {
  const value = process.env[key];
  return value ? value.trim() : undefined;
};

const authTypeRaw = optionalEnv('JIRA_AUTH_TYPE')?.toLowerCase();
const jiraAuthType = authTypeRaw === 'pat' ? 'pat' : 'basic';
const parseBool = (value: string | undefined): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

export const config = {
  jira: {
    baseUrl: normalizeBaseUrl(requireEnv('JIRA_BASE_URL')),
    email: jiraAuthType === 'basic' ? requireEnv('JIRA_EMAIL') : optionalEnv('JIRA_EMAIL') || '',
    apiToken: requireEnv('JIRA_API_TOKEN'),
    authType: jiraAuthType,
    userProjectKey: requireEnv('USER_PROJECT_KEY'),
    devProjectKey: requireEnv('DEV_PROJECT_KEY'),
  },
  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES || 5),
  databaseUrl: requireEnv('DATABASE_URL'),
  databaseName: optionalEnv('WORKER_DATABASE_NAME') || requireEnv('DATABASE_NAME'),
};

const pino = (pinoImport as any).default ?? pinoImport;
const prettyLogs = parseBool(process.env.LOG_PRETTY) || process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: prettyLogs ? { target: 'pino-pretty' } : undefined,
});

export const buildIssueUrl = (issueKey: string): string => `${config.jira.baseUrl}/browse/${issueKey}`;
