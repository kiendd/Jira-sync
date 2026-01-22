# Tasks: remove-env-config-duplication

## Phase 1: Analysis & Planning

- [x] 1.1 Document current configuration flow (DONE)
- [x] 1.2 Identify all files using JIRA env vars (DONE: src/config/index.ts, src/sync/config-loader.ts)
- [x] 1.3 Confirm no fallback requirement (DONE - NO FALLBACK, file-only)

## Phase 2: Implementation

### 2.1 Modify src/config/index.ts

- [x] 2.1.1 Remove all JIRA env vars: JIRA_BASE_URL, JIRA_API_TOKEN, JIRA_EMAIL, USER_PROJECT_KEY, DEV_PROJECT_KEY
- [x] 2.1.2 Remove JIRA_AUTH_TYPE (no longer needed in env)
- [x] 2.1.3 Update config export to remove jira object
- [x] 2.1.4 Keep infrastructure config: LOG_LEVEL, PORT, SYNC_INTERVAL_MINUTES, DATABASE_URL, DATABASE_NAME, CONFIG_DIR
- [x] 2.1.5 Add validation that config files exist at startup

### 2.2 Update src/sync/config-loader.ts

- [x] 2.2.1 Remove `applyEnvFallback()` function entirely
- [x] 2.2.2 Remove `optionalEnv()` calls for JIRA variables
- [x] 2.2.3 Update `getDefaultConfig()` to not use env vars for JIRA
- [x] 2.2.4 Simplify `loadConfigFromFile()` to pure JSON loading
- [x] 2.2.5 Add validation for required JIRA fields in JSON config:
  - jira.baseUrl
  - jira.apiToken
  - jira.email (for basic auth)
  - userProjectKey
  - devProjectKey

### 2.3 Update src/sync/worker.ts

- [x] 2.3.1 Remove any env var dependencies
- [x] 2.3.2 Add logging when config is loaded from file
- [x] 2.3.3 Add pre-flight validation for JIRA config completeness

### 2.4 Update src/index.ts

- [x] 2.4.1 Add startup validation to check config directory
- [x] 2.4.2 Fail early with clear error if no config files found
- [x] 2.4.3 Update health check to reflect new config model

### 2.5 Update docker-compose.yml

- [x] 2.5.1 Remove JIRA_AUTH_TYPE, JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, USER_PROJECT_KEY, DEV_PROJECT_KEY
- [x] 2.5.2 Keep: DATABASE_URL, SYNC_INTERVAL_MINUTES, LOG_LEVEL, PORT, CONFIG_DIR
- [x] 2.5.3 Update comments to clarify config comes from JSON files only

### 2.6 Update .env.example

- [x] 2.6.1 Remove all JIRA_* variables (already removed)
- [x] 2.6.2 Keep infrastructure variables
- [x] 2.6.3 Add comment pointing to config/ directory for JIRA config

### 2.7 Remove deprecated env var handling

- [x] 2.7.1 Remove any fallback code paths
- [x] 2.7.2 Remove unused imports (optionalEnv if only for JIRA)
- [x] 2.7.3 Clean up comments about env var fallback

## Phase 3: Testing

### 3.1 Unit Tests

- [ ] 3.1.1 Test config loader with no config files (should fail)
- [ ] 3.1.2 Test config loader with valid JSON config
- [ ] 3.1.3 Test config loader with invalid JSON (should fail)
- [ ] 3.1.4 Test missing required fields in JSON (should fail)

### 3.2 Integration Tests

- [ ] 3.2.1 Test Docker Compose startup with JSON config only
- [ ] 3.2.2 Test multiple workers with different JIRA configs
- [ ] 3.2.3 Test worker spawning and health check
- [ ] 3.2.4 Test error scenario: no config files

### 3.3 Manual Testing

- [ ] 3.3.1 Clean installation test (no env vars set)
- [ ] 3.3.2 Multiple JIRA instances test
- [ ] 3.3.3 Error message clarity test
- [ ] 3.3.4 Sync operations test with file-based config

## Phase 4: Documentation

- [x] 4.1 Update DEPLOY.md - remove JIRA env var references
- [x] 4.2 Add section: "Configuring Multiple JIRA Instances" (already documented)
- [x] 4.3 Add example JSON config files in config/sync-*.json format (already exists)
- [x] 4.4 Document migration path from env vars to JSON config
- [ ] 4.5 Update README.md with new config approach

## Phase 5: Validation

- [x] 5.1 Run `openspec validate remove-env-config-duplication`
- [x] 5.2 Run `npm run lint` (tsc --noEmit)
- [x] 5.3 Run `npm run build`
- [ ] 5.4 Final review and merge
