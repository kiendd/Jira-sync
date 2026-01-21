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
├── scheduler.ts  # Cron-based sync trigger
└── index.ts      # Entry point
```

## Additional Notes

- MongoDB collections auto-created on first write
- Supports basic auth (email + API token) or PAT authentication
- Sync runs on `SYNC_INTERVAL_MINUTES` cron schedule
- All logs use pino logger with structured JSON output
