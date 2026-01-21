# Project Context

## Purpose

Node.js/TypeScript service that syncs two Jira projects bidirectionally:
- **User Project**: User-facing issues, comments, and bug reports
- **Dev Project**: Development team issues that receive/send data to/from User Project

The service runs on a cron schedule to keep both projects in sync, maintaining issue mappings and timestamps.

## Tech Stack

- **Runtime**: Node.js (ES2021)
- **Language**: TypeScript with strict mode
- **Module System**: ESM (ECMAScript Modules)
- **Database**: MongoDB with Mongoose ODM
- **Jira Integration**: jira.js (REST API client)
- **Scheduling**: node-cron
- **Logging**: pino (structured JSON logging)
- **Configuration**: dotenv

## Project Conventions

### Code Style

- ESM imports with `.js` extension: `import { foo } from './bar.js'`
- Explicit return types for exported functions
- `Record<string, any>` for flexible Jira field types
- No comments unless explicitly requested

### Architecture Patterns

- **Singleton**: Reuse single `JiraClient` instance across the application
- **Repository Pattern**: Data access layer in `src/db/` with Mongoose models
- **Barrel Exports**: Clean imports via `src/*/index.ts` files
- **Layered Architecture**: config → db → jira → sync → scheduler → index

### Testing Strategy

Manual testing scripts only:
- `npm run sync:init` - Initial status scan
- `npm run test:list-user-project` - List user project issues
- `npm run test:auth` - Test Jira authentication
- `npm run test:sync-cycle` - Full sync cycle test

### Git Workflow

- Conventional commits (subject only, no body)
- Feature branches for new work
- Squash and merge to main

## Domain Context

- **Jira Projects**: Two distinct projects (User-facing vs Dev-facing)
- **Bidirectional Sync**: Changes flow both ways between projects
- **Issue Mapping**: Maintains mappings between User and Dev issue keys
- **Sync State**: Tracks last sync timestamp per project
- **MongoDB**: Stores sync state, issue mappings, and timestamps

## Important Constraints

- MongoDB collections auto-created on first write
- Supports basic auth (email + API token) or PAT authentication
- Sync runs on `SYNC_INTERVAL_MINUTES` cron schedule
- All logs use pino logger with structured JSON output

## External Dependencies

- **Jira Cloud API**: REST endpoints for issue CRUD operations
- **MongoDB**: Database for sync state and mappings
