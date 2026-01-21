import mongoose, { Schema, model } from 'mongoose';

export type JiraMappingDoc = {
  user_issue_key: string;
  dev_issue_key: string;
  user_issue_url: string;
  dev_issue_url: string;
  created_at: Date;
};

export type SyncStateDoc = {
  name: string;
  last_sync: Date;
};

export type UserProjectIssueStateDoc = {
  issue_key: string;
  status: string;
  updated_at: Date;
};

export type DevProjectIssueStateDoc = {
  issue_key: string;
  status: string;
  updated_at: Date;
};

export type JiraConfig = {
  baseUrl: string;
  email?: string;
  apiToken: string;
  authType: 'basic' | 'pat';
};

export type SyncDirection = 'user_to_dev' | 'dev_to_user' | 'both' | 'none';

export type SyncRuleActions = {
  createIssue?: boolean;
  syncStatus?: boolean;
  syncAttachments?: boolean;
  addComment?: boolean;
  addCrossLink?: boolean;
  commentTemplate?: string;
  targetStatus?: string;
};

export type SyncRule = {
  id?: string;
  sourceStatus: string;
  targetProject: 'dev' | 'user';
  targetStatus?: string;
  syncDirection: SyncDirection;
  enabled: boolean;
  priority?: number;
  description?: string;
  conditions?: {
    requireMapping?: boolean;
    onStatusChange?: boolean;
  };
  actions?: SyncRuleActions;
};

export type SyncFlowConfigDoc = {
  name: string;
  description?: string;
  jira?: JiraConfig;
  userProjectKey: string;
  devProjectKey: string;
  syncIntervalMinutes?: number;
  defaultBehavior?: {
    syncAttachments?: boolean;
    addCrossLinks?: boolean;
    onlyOnStatusChange?: boolean;
    skipIntermediateStatuses?: boolean;
  };
  rules: SyncRule[];
  created_at?: Date;
  updated_at?: Date;
};

const JiraMappingSchema = new Schema<JiraMappingDoc>(
  {
    user_issue_key: { type: String, required: true, unique: true },
    dev_issue_key: { type: String, required: true, unique: true },
    user_issue_url: { type: String, required: true },
    dev_issue_url: { type: String, required: true },
    created_at: { type: Date, default: () => new Date() },
  },
  { collection: 'jira_mapping' }
);

const SyncStateSchema = new Schema<SyncStateDoc>(
  {
    name: { type: String, required: true, unique: true },
    last_sync: { type: Date, required: true },
  },
  { collection: 'sync_state' }
);

const UserProjectIssueStateSchema = new Schema<UserProjectIssueStateDoc>(
  {
    issue_key: { type: String, required: true, unique: true },
    status: { type: String, required: true },
    updated_at: { type: Date, default: () => new Date() },
  },
  { collection: 'user_project_issue_state' }
);

const DevProjectIssueStateSchema = new Schema<DevProjectIssueStateDoc>(
  {
    issue_key: { type: String, required: true, unique: true },
    status: { type: String, required: true },
    updated_at: { type: Date, default: () => new Date() },
  },
  { collection: 'dev_project_issue_state' }
);

export const JiraMappingModel =
  mongoose.models.jira_mapping || model<JiraMappingDoc>('jira_mapping', JiraMappingSchema);
export const SyncStateModel =
  mongoose.models.sync_state || model<SyncStateDoc>('sync_state', SyncStateSchema);
export const UserProjectIssueStateModel =
  mongoose.models.user_project_issue_state ||
  model<UserProjectIssueStateDoc>('user_project_issue_state', UserProjectIssueStateSchema);
export const DevProjectIssueStateModel =
  mongoose.models.dev_project_issue_state ||
  model<DevProjectIssueStateDoc>('dev_project_issue_state', DevProjectIssueStateSchema);
