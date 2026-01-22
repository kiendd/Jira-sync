# Tasks: cleanup-database-config

## Phase 1: Analysis & Planning

- [x] 1.1 Document current database config flow (DONE)
- [x] 1.2 Identify all files using databaseName from config

## Phase 2: Remove Redundant Config

### 2.1 Update src/config/index.ts

- [x] 2.1.1 Remove `databaseName` from config export
- [x] 2.1.2 Keep `databaseUrl` for db connection
- [x] 2.1.3 Clean up comments

### 2.2 Update src/db/index.ts

- [x] 2.2.1 Verify `config.databaseUrl` is still used
- [x] 2.2.2 Remove any reference to `config.databaseName`
- [x] 2.2.3 Add optional `databaseName` parameter to `connectDb()`
- [x] 2.2.4 Update worker.ts to pass `databaseName` to `connectDb()`

## Phase 3: Documentation

- [x] 3.1 Update DEPLOY.md to clarify database config
- [x] 3.2 Document that DATABASE_URL is global
- [x] 3.3 Document that DATABASE_NAME is derived from worker name

## Phase 4: Validation

- [x] 4.1 Run `openspec validate cleanup-database-config`
- [x] 4.2 Run `npm run lint`
- [x] 4.3 Run `npm run build`
- [ ] 4.4 Final review
