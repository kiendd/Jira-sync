import { logger } from '../config/index.js';
import {
  getUserProjectIssueState,
  upsertUserProjectIssueState,
  getDevProjectIssueState,
  upsertDevProjectIssueState,
} from '../db/repo.js';
import { logStatusChanged, logStatusUnchanged } from './audit-logger.js';

export type ProjectType = 'user' | 'dev';

export interface IssueState {
  issueKey: string;
  projectType: ProjectType;
  status: string;
  updatedAt: Date;
}

export interface StatusChange {
  issueKey: string;
  projectType: ProjectType;
  fromStatus: string | null;
  toStatus: string;
  timestamp: Date;
}

const getStateFromDoc = (
  doc: { issue_key: string; status: string; updated_at: Date } | null,
  projectType: ProjectType
): IssueState | null => {
  if (!doc) return null;
  return {
    issueKey: doc.issue_key,
    projectType,
    status: doc.status,
    updatedAt: doc.updated_at,
  };
};

export const getIssueState = async (
  issueKey: string,
  projectType: ProjectType
): Promise<IssueState | null> => {
  if (projectType === 'user') {
    const doc = await getUserProjectIssueState(issueKey);
    return getStateFromDoc(doc, 'user');
  } else {
    const doc = await getDevProjectIssueState(issueKey);
    return getStateFromDoc(doc, 'dev');
  }
};

export const updateIssueState = async (
  issueKey: string,
  projectType: ProjectType,
  status: string
): Promise<IssueState> => {
  if (projectType === 'user') {
    const doc = await upsertUserProjectIssueState({ issueKey, status });
    return {
      issueKey: doc.issue_key,
      projectType: 'user',
      status: doc.status,
      updatedAt: doc.updated_at,
    };
  } else {
    const doc = await upsertDevProjectIssueState({ issueKey, status });
    return {
      issueKey: doc.issue_key,
      projectType: 'dev',
      status: doc.status,
      updatedAt: doc.updated_at,
    };
  }
};

export const detectStatusChange = async (
  issueKey: string,
  projectType: ProjectType,
  newStatus: string
): Promise<StatusChange | null> => {
  const existing = await getIssueState(issueKey, projectType);
  const previousStatus = existing?.status ?? null;
  const isNewIssue = previousStatus === null;

  await updateIssueState(issueKey, projectType, newStatus);

  if (previousStatus && previousStatus !== newStatus) {
    const change: StatusChange = {
      issueKey,
      projectType,
      fromStatus: previousStatus,
      toStatus: newStatus,
      timestamp: new Date(),
    };

    logStatusChanged(
      issueKey,
      projectType,
      previousStatus,
      newStatus,
      isNewIssue
    );

    return change;
  }

  if (!previousStatus) {
    logStatusChanged(
      issueKey,
      projectType,
      null,
      newStatus,
      true
    );
  } else {
    logStatusUnchanged(
      issueKey,
      projectType,
      newStatus
    );
  }

  return null;
};
