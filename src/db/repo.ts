import {
  JiraMappingDoc,
  JiraMappingModel,
  SyncStateDoc,
  SyncStateModel,
  UserProjectIssueStateDoc,
  UserProjectIssueStateModel,
} from './models.js';

const SYNC_STATE_NAME = 'jira-sync';
const STATUS_SYNC_STATE_NAME = 'jira-status-sync';

export const getMappingByUserKey = async (
  userIssueKey: string
): Promise<JiraMappingDoc | null> =>
  JiraMappingModel.findOne({ user_issue_key: userIssueKey }).lean<JiraMappingDoc | null>();

export const getMappingByDevKey = async (
  devIssueKey: string
): Promise<JiraMappingDoc | null> =>
  JiraMappingModel.findOne({ dev_issue_key: devIssueKey }).lean<JiraMappingDoc | null>();

export const createMapping = async (params: {
  userIssueKey: string;
  devIssueKey: string;
  userIssueUrl: string;
  devIssueUrl: string;
}): Promise<JiraMappingDoc> =>
  JiraMappingModel.create({
    user_issue_key: params.userIssueKey,
    dev_issue_key: params.devIssueKey,
    user_issue_url: params.userIssueUrl,
    dev_issue_url: params.devIssueUrl,
  });

export const getLastSync = async (): Promise<Date | null> => {
  const state = await SyncStateModel.findOne({ name: SYNC_STATE_NAME }).lean<SyncStateDoc | null>();
  return state?.last_sync ?? null;
};

export const updateLastSync = async (lastSync: Date) =>
  SyncStateModel.findOneAndUpdate(
    { name: SYNC_STATE_NAME },
    { $set: { last_sync: lastSync } },
    { upsert: true, new: true }
  );

export const getLastStatusSync = async (): Promise<Date | null> => {
  const state = await SyncStateModel.findOne({ name: STATUS_SYNC_STATE_NAME }).lean<SyncStateDoc | null>();
  return state?.last_sync ?? null;
};

export const updateLastStatusSync = async (lastSync: Date) =>
  SyncStateModel.findOneAndUpdate(
    { name: STATUS_SYNC_STATE_NAME },
    { $set: { last_sync: lastSync } },
    { upsert: true, new: true }
  );

export const getUserProjectIssueState = async (
  issueKey: string
): Promise<UserProjectIssueStateDoc | null> =>
  UserProjectIssueStateModel.findOne({ issue_key: issueKey }).lean<UserProjectIssueStateDoc | null>();

export const upsertUserProjectIssueState = async (params: {
  issueKey: string;
  status: string;
}): Promise<UserProjectIssueStateDoc> =>
  UserProjectIssueStateModel.findOneAndUpdate(
    { issue_key: params.issueKey },
    { $set: { status: params.status, updated_at: new Date() } },
    { upsert: true, new: true }
  ).lean<UserProjectIssueStateDoc>().then((doc) => {
    if (!doc) {
      throw new Error('Failed to upsert user project issue state');
    }
    return doc;
  });
