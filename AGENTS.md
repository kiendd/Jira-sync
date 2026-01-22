<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AGENTS.md - Jira Sync Service

## Project Overview

Node.js/TypeScript service that syncs two Jira projects:
- User Project: User-facing issues, comments, bug reports
- Dev Project: Development team issues receiving/sending data to/from User Project

## Commands

```bash
# Build & Run
npm start          # Build + run production (tsc + node dist/index.js)
npm run build      # TypeScript compilation (tsc -p tsconfig.json)
npm run lint       # Type checking only (tsc --noEmit)

# Dev Scripts
npm run sync:init                    # Initial status scan (no Dev issues created)
npm run test:list-user-project       # List user project issues
npm run test:auth                    # Test Jira authentication
npm run test:sync-cycle              # Full sync cycle test (build + run)

# Manual Testing
node --loader ts-node/esm scripts/initial-sync.ts
ts-node-esm scripts/test-auth.ts
```

## Code Style Guidelines

### TypeScript & ESM
- Use ESM imports with `.js` extension: `import { foo } from './bar.js'`
- Always enable strict mode (already in tsconfig.json)
- Define explicit return types for exported functions
- Use `Record<string, any>` for flexible Jira field types

### Naming Conventions
- **Classes**: PascalCase (`JiraClient`, `SyncStateModel`)
- **Functions/variables**: camelCase (`syncDevProjectToUserProject`, `lastSync`)
- **Database fields**: snake_case (`user_issue_key`, `created_at`)
- **Constants**: SCREAMING_SNAKE_CASE (`SYNC_STATE_NAME`)
- **Type exports**: Suffix with `Doc` for Mongoose document types (`JiraMappingDoc`)

### Imports & Organization
- Group imports: external libs → internal modules
- Use barrel exports in `src/*/index.ts` for clean imports
- Keep utility functions in the same file when closely related

### Error Handling
- Throw `Error` with descriptive messages for failures
- Log errors with structured logger: `logger.error({ err }, 'message')`
- Validate env vars at startup with `requireEnv()` helper
- Handle async operations with try/catch in async functions

### Mongoose Patterns
- Export document types separately from models
- Use `lean<T>()` for read-only queries
- Handle potential null returns with explicit `| null` types
- Use `findOneAndUpdate` with `upsert: true` for upsert patterns

### Jira Integration
- Reuse single `JiraClient` instance (singleton pattern)
- Use structured logging for API calls: `logger.info({ jql, count }, 'message')`
- Validate API responses before processing
- Build URLs with helper: `buildIssueUrl(issueKey)`

### Database Field Conventions
- Use snake_case for all MongoDB fields
- Include `created_at` and `updated_at` timestamps
- Index frequently queried fields (`unique: true` for keys)

## Project Structure

```
src/
├── config/       # Env loading, logger, utilities
├── db/           # Mongoose models, repo layer
├── jira/         # Jira REST client, project wrappers
├── sync/         # Bidirectional sync logic
│   ├── issue-state-tracker.ts    # Unified issue state tracking
│   ├── monitor-all-projects.ts   # Monitor both projects for status changes
│   ├── status-change-matcher.ts  # Match status changes to rules
│   ├── status-change-actions.ts  # Execute actions for status changes
│   ├── sync-user-to-dev.ts       # User to Dev sync (regular + status changes)
│   └── sync-dev-to-user.ts       # Dev to User sync (regular + status changes)
├── scheduler.ts  # Cron-based sync trigger
└── index.ts      # Entry point
```

## Status Change Detection Architecture

The system implements an event-driven status change detection approach:

### Key Components

1. **Issue State Tracker** (`src/sync/issue-state-tracker.ts`)
   - Tracks status for both User and Dev issues
   - Stores: issueKey, projectType, status, updatedAt
   - Methods: `getState()`, `updateState()`, `detectChange()`

2. **Project Monitor** (`src/sync/monitor-all-projects.ts`)
   - Monitors both User and Dev projects for status changes
   - Returns list of detected changes: `{ issueKey, project, fromStatus, toStatus, timestamp }`

3. **Status Change Matcher** (`src/sync/status-change-matcher.ts`)
   - Matches status changes against configuration rules
   - Supports exact match and wildcard patterns

4. **Action Executor** (`src/sync/status-change-actions.ts`)
   - Executes configured actions for matched status changes
   - Supports: syncStatus, createIssue, addComment, addCrossLink

### Sync Flow

```
Cron Job → fetchAllIssues() → detectStatusChanges() → evaluateRules() → executeActions()
```

### Configuration

Rules support status change detection with:
- `sourceStatus`: Status to match (exact match or `*` for wildcard)
- `syncDirection`: `user_to_dev`, `dev_to_user`, or `both`
- `conditions.onStatusChange`: Only execute when status actually changed
- `actions.targetStatus`: Target status for sync (can differ from source)

Example rule for syncing "Resolved" status:
```json
{
  "sourceStatus": "Resolved",
  "syncDirection": "user_to_dev",
  "conditions": { "requireMapping": true, "onStatusChange": true },
  "actions": { "syncStatus": true, "targetStatus": "Closed" }
}
```

## Audit Logging

The system provides structured audit logging for issue sync operations to help operators verify and debug sync behavior.

### Log Event Types

| Event | Description | Key Fields |
|-------|-------------|------------|
| `issue.fetched` | Issue fetched from Jira | `issueKey`, `issueTitle`, `projectType`, `currentStatus` |
| `issue.processed` | Issue processed by sync logic | `issueKey`, `ruleId`, `action`, `targetKey` |
| `status.changed` | Status change detected | `issueKey`, `fromStatus`, `toStatus`, `isNewIssue` |
| `status.unchanged` | No status change (debug) | `issueKey`, `currentStatus` |
| `action.createIssue` | New issue created | `sourceKey`, `targetKey`, `status` |
| `action.syncStatus` | Status synced | `sourceKey`, `targetKey`, `targetStatus` |
| `action.skipped` | Issue skipped | `issueKey`, `reason`, `details` |
| `sync.cycle.completed` | Sync cycle summary | `durationMs`, `issuesFetched`, `statusChangesDetected`, `issuesCreated`, `statusesSynced`, `issuesSkipped`, `errors` |

### Example Log Output

```json
{"event":"issue.fetched","issueKey":"FSNX-230","issueTitle":"Login button broken","projectType":"user","currentStatus":"Will Do","updatedAt":"2026-01-22T17:00:00.000Z"}

{"event":"status.changed","issueKey":"FSNX-230","projectType":"user","fromStatus":"Open","toStatus":"Will Do","isNewIssue":true,"timestamp":"2026-01-22T17:00:01.000Z"}

{"event":"action.createIssue","sourceKey":"FSNX-230","sourceTitle":"Login button broken","sourceProject":"user","targetKey":"DC5SNX-123","targetProject":"dev","status":"Open"}

{"event":"issue.processed","issueKey":"FSNX-230","issueTitle":"Login button broken","projectType":"user","currentStatus":"Will Do","ruleId":"user-will-do","action":"createIssue","targetKey":"DC5SNX-123","mappingExists":false}

{"event":"sync.cycle.completed","worker":"sync-snx","durationMs":1523,"issuesFetched":10,"statusChangesDetected":3,"issuesCreated":2,"statusesSynced":1,"issuesSkipped":4,"errors":0}
```

### Using Audit Logs

Filter logs for specific events:
```bash
# View only issue processing
grep '"event":"issue.processed"' sync.log

# View only status changes
grep '"event":"status.changed"' sync.log

# View sync cycle summaries
grep '"event":"sync.cycle.completed"' sync.log

# View errors only
grep '"errors":[1-9]' sync.log
```

### Metrics Tracked

The `SyncMetrics` class tracks the following during each sync cycle:
- `issuesFetched`: Total issues fetched from Jira
- `statusChangesDetected`: Number of status changes found
- `issuesCreated`: Number of new issues created
- `statusesSynced`: Number of status synchronizations performed
- `issuesSkipped`: Number of issues skipped
- `errors`: Number of errors encountered

## Additional Notes

- MongoDB collections auto-created on first write
- Supports basic auth (email + API token) or PAT authentication
- Sync runs on `SYNC_INTERVAL_MINUTES` cron schedule
- All logs use pino logger with structured JSON output
