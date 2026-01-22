import dotenv from 'dotenv';
import pinoImport from 'pino';

dotenv.config();

const optionalEnv = (key: string): string | undefined => {
  const value = process.env[key];
  return value ? value.trim() : undefined;
};

const parseBool = (value: string | undefined): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

export const config = {
  jira: {
    baseUrl: optionalEnv('JIRA_BASE_URL') || '',
    email: optionalEnv('JIRA_EMAIL') || '',
    apiToken: optionalEnv('JIRA_API_TOKEN') || '',
    authType: (optionalEnv('JIRA_AUTH_TYPE') as 'basic' | 'pat') || 'pat',
    userProjectKey: optionalEnv('USER_PROJECT_KEY') || '',
    devProjectKey: optionalEnv('DEV_PROJECT_KEY') || '',
  },
  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES || 5),
  databaseUrl: optionalEnv('DATABASE_URL') || 'mongodb://localhost:27017',
  logLevel: optionalEnv('LOG_LEVEL') || 'info',
  port: Number(optionalEnv('PORT') || 3000),
  configDir: optionalEnv('CONFIG_DIR') || './config',
};

const pino = (pinoImport as any).default ?? pinoImport;
const prettyLogs = parseBool(process.env.LOG_PRETTY) || process.env.NODE_ENV === 'development';
const logFile = process.env.LOG_FILE;

const loggerOptions: Record<string, any> = {
  level: config.logLevel,
};

if (logFile) {
  loggerOptions.transport = {
    targets: [
      { target: 'pino/file', options: { destination: 1 } },
      { target: 'pino/file', options: { destination: logFile } },
    ],
  };
} else if (prettyLogs) {
  loggerOptions.transport = { target: 'pino-pretty' };
}

export const logger = pino(loggerOptions);

export const buildIssueUrl = (issueKey: string): string => `${config.jira.baseUrl}/browse/${issueKey}`;
