import { logger } from '../config/index.js';

export type ProjectType = 'user' | 'dev';
export type SyncDirection = 'user_to_dev' | 'dev_to_user';
export type AuditAction = 'createIssue' | 'syncStatus' | 'skip' | 'noRule';
export type SkipReason = 'noRule' | 'requireMapping' | 'hasLink' | 'noChange' | 'noMapping';

interface IssueFetchedLog {
  event: 'issue.fetched';
  issueKey: string;
  issueTitle: string;
  projectType: ProjectType;
  currentStatus: string;
  updatedAt: string | null;
}

interface IssueProcessedLog {
  event: 'issue.processed';
  issueKey: string;
  issueTitle: string;
  projectType: ProjectType;
  currentStatus: string;
  ruleId: string;
  action: AuditAction;
  targetKey?: string;
  mappingExists: boolean;
}

interface StatusChangedLog {
  event: 'status.changed';
  issueKey: string;
  projectType: ProjectType;
  fromStatus: string | null;
  toStatus: string;
  isNewIssue: boolean;
  timestamp: string;
}

interface StatusUnchangedLog {
  event: 'status.unchanged';
  issueKey: string;
  projectType: ProjectType;
  currentStatus: string;
}

interface ActionCreateIssueLog {
  event: 'action.createIssue';
  sourceKey: string;
  sourceTitle: string;
  sourceProject: ProjectType;
  targetKey: string;
  targetProject: ProjectType;
  status: string;
}

interface ActionSyncStatusLog {
  event: 'action.syncStatus';
  sourceKey: string;
  sourceStatus: string;
  targetKey: string;
  targetStatus: string;
  direction: SyncDirection;
}

interface ActionSkippedLog {
  event: 'action.skipped';
  issueKey: string;
  reason: SkipReason;
  details?: string;
}

interface SyncCycleCompletedLog {
  event: 'sync.cycle.completed';
  worker: string;
  durationMs: number;
  issuesFetched: number;
  statusChangesDetected: number;
  issuesCreated: number;
  statusesSynced: number;
  issuesSkipped: number;
  errors: number;
  errorCount?: number;
  firstError?: string;
}

type AuditLogEntry =
  | IssueFetchedLog
  | IssueProcessedLog
  | StatusChangedLog
  | StatusUnchangedLog
  | ActionCreateIssueLog
  | ActionSyncStatusLog
  | ActionSkippedLog
  | SyncCycleCompletedLog;

export const logIssueFetched = (
  issueKey: string,
  issueTitle: string,
  projectType: ProjectType,
  currentStatus: string,
  updatedAt: string | null
): void => {
  const log: IssueFetchedLog = {
    event: 'issue.fetched',
    issueKey,
    issueTitle,
    projectType,
    currentStatus,
    updatedAt,
  };
  logger.info(log);
};

export const logIssueProcessed = (
  issueKey: string,
  issueTitle: string,
  projectType: ProjectType,
  currentStatus: string,
  ruleId: string,
  action: AuditAction,
  targetKey?: string,
  mappingExists: boolean = false
): void => {
  const log: IssueProcessedLog = {
    event: 'issue.processed',
    issueKey,
    issueTitle,
    projectType,
    currentStatus,
    ruleId,
    action,
    targetKey,
    mappingExists,
  };
  logger.info(log);
};

export const logStatusChanged = (
  issueKey: string,
  projectType: ProjectType,
  fromStatus: string | null,
  toStatus: string,
  isNewIssue: boolean
): void => {
  const log: StatusChangedLog = {
    event: 'status.changed',
    issueKey,
    projectType,
    fromStatus,
    toStatus,
    isNewIssue,
    timestamp: new Date().toISOString(),
  };
  logger.info(log);
};

export const logStatusUnchanged = (
  issueKey: string,
  projectType: ProjectType,
  currentStatus: string
): void => {
  const log: StatusUnchangedLog = {
    event: 'status.unchanged',
    issueKey,
    projectType,
    currentStatus,
  };
  logger.debug(log);
};

export const logActionCreateIssue = (
  sourceKey: string,
  sourceTitle: string,
  sourceProject: ProjectType,
  targetKey: string,
  targetProject: ProjectType,
  status: string
): void => {
  const log: ActionCreateIssueLog = {
    event: 'action.createIssue',
    sourceKey,
    sourceTitle,
    sourceProject,
    targetKey,
    targetProject,
    status,
  };
  logger.info(log);
};

export const logActionSyncStatus = (
  sourceKey: string,
  sourceStatus: string,
  targetKey: string,
  targetStatus: string,
  direction: SyncDirection
): void => {
  const log: ActionSyncStatusLog = {
    event: 'action.syncStatus',
    sourceKey,
    sourceStatus,
    targetKey,
    targetStatus,
    direction,
  };
  logger.info(log);
};

export const logActionSkipped = (
  issueKey: string,
  reason: SkipReason,
  details?: string
): void => {
  const log: ActionSkippedLog = {
    event: 'action.skipped',
    issueKey,
    reason,
    details,
  };
  logger.debug(log);
};

export const logSyncCycleCompleted = (
  worker: string,
  durationMs: number,
  metrics: {
    issuesFetched: number;
    statusChangesDetected: number;
    issuesCreated: number;
    statusesSynced: number;
    issuesSkipped: number;
    errors: number;
    errorCount?: number;
    firstError?: string;
  }
): void => {
  const log: SyncCycleCompletedLog = {
    event: 'sync.cycle.completed',
    worker,
    durationMs,
    issuesFetched: metrics.issuesFetched,
    statusChangesDetected: metrics.statusChangesDetected,
    issuesCreated: metrics.issuesCreated,
    statusesSynced: metrics.statusesSynced,
    issuesSkipped: metrics.issuesSkipped,
    errors: metrics.errors,
    errorCount: metrics.errorCount,
    firstError: metrics.firstError,
  };
  logger.info(log);
};

export class SyncMetrics {
  private startTime: bigint;
  private worker: string;
  issuesFetched: number = 0;
  statusChangesDetected: number = 0;
  issuesCreated: number = 0;
  statusesSynced: number = 0;
  issuesSkipped: number = 0;
  errors: number = 0;
  private firstErrorMsg: string | null = null;

  constructor(worker: string) {
    this.worker = worker;
    this.startTime = process.hrtime.bigint();
  }

  incrementIssuesFetched(count: number = 1): void {
    this.issuesFetched += count;
  }

  incrementStatusChangesDetected(count: number = 1): void {
    this.statusChangesDetected += count;
  }

  incrementIssuesCreated(count: number = 1): void {
    this.issuesCreated += count;
  }

  incrementStatusesSynced(count: number = 1): void {
    this.statusesSynced += count;
  }

  incrementIssuesSkipped(count: number = 1): void {
    this.issuesSkipped += count;
  }

  incrementErrors(errorMessage?: string): void {
    this.errors += 1;
    if (!this.firstErrorMsg && errorMessage) {
      this.firstErrorMsg = errorMessage.slice(0, 200);
    }
  }

  complete(): void {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - this.startTime) / 1_000_000;

    logSyncCycleCompleted(this.worker, durationMs, {
      issuesFetched: this.issuesFetched,
      statusChangesDetected: this.statusChangesDetected,
      issuesCreated: this.issuesCreated,
      statusesSynced: this.statusesSynced,
      issuesSkipped: this.issuesSkipped,
      errors: this.errors,
      errorCount: this.errors,
      firstError: this.firstErrorMsg || undefined,
    });
  }
}
