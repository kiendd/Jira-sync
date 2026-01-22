# Audit and Fix Sync Core

## Goal
Address critical stability and flexibility issues in the Jira Sync Service identified during audit:
1.  **Dynamic Status Handling**: Replace hardcoded "Resolved" checks with flexible **Status Category** checks to support various project workflows (e.g., "Done", "Closed", "Finished").
2.  **Startup Validation**: Implement robust configuration validation at startup to ensure Jira connectivity and Project/Status existence before running workers.
3.  **Sync Loop Prevention**: Audit and reinforce logic to prevent "ping-pong" sync loops between User and Dev projects.
4.  **Multi-Worker Safety**: Validate configuration to ensure no process overlap and correct database isolation.

## Context
The current system has several fragilities:
- **Hardcoded Logic**: `resolveUserIssue` assumes a specific list of resolution statuses, failing for projects like SNX that use "Done".
- **Blind Startup**: Workers start without validating credentials or project keys, leading to runtime failures and log noise.
- **Potential Races**: Multiple workers could theoretically overlap on projects if misconfigured, though DB isolation (`dbName`) mitigates some data corruption risks.
- **Sync Logic**: User updates are synced to Dev, but if statuses don't align perfectly in the config (e.g. name mismatch), they fail silently or might bounce if rules are not carefully paired.

## Solution

### 1. Dynamic Resolution (Status Category)
- **Mechanism**: Fetch `statusCategory` from Jira for the target status.
- **Logic**: If `statusCategory.key === 'done'`, treat the transition as a resolution event (triggering `replied: true` and appropriate logging).
- **Benefit**: Works for ANY status (Resolved, Done, Closed) without code changes/hardcoding.

### 2. Robust Startup Validation
- **Connectivity Check**: Verify `JIRA_BASE_URL` and Auth (PAT/Basic) by calling `/myself` or similar.
- **Project Validation**: Verify `USER_PROJECT_KEY` and `DEV_PROJECT_KEY` exist.
- **Status Validation**: Verify that statuses defined in `rules` actually exist in the respective projects.
- **Action**: Fail fast (exit process) if validation fails, preventing "zombie" workers that just spew errors.

### 3. Sync Logic Reinforcement
- **Loop Detection**: Ensure `statusChanged` checking is strict. Add "last updated by" check if possible (though Jira API makes this hard without history fetch).
- **Rule Validation**: Ensure rules are not contradictory (e.g., A->B and B->A with no terminal state). *Initial step: Warnings in logs.*

### 4. Config & Environment Fixes
- **Env Loading**: Fix `src/config/index.ts` to properly load environment variables (as found in previous audit).
- **Worker Isolation**: Enforce unique `DATABASE_NAME` per worker or validated non-overlapping projects.

## Architecture
- **No fundamental change** to the multi-process architecture.
- **Enhancement**: Add a `Validator` class used by `worker.ts` before `startScheduler`.

## Risks
- **Performance**: Startup will take slightly longer due to validation API calls.
- **Strictness**: Invalid configs that "partially worked" will now fail completely at startup (which is good, but a change).
