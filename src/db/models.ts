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

export const JiraMappingModel =
  mongoose.models.jira_mapping || model<JiraMappingDoc>('jira_mapping', JiraMappingSchema);
export const SyncStateModel =
  mongoose.models.sync_state || model<SyncStateDoc>('sync_state', SyncStateSchema);
export const UserProjectIssueStateModel =
  mongoose.models.user_project_issue_state ||
  model<UserProjectIssueStateDoc>('user_project_issue_state', UserProjectIssueStateSchema);
