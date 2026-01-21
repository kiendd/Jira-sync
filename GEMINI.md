# Jira Sync Service

## Project Overview
This project is a Node.js/TypeScript service designed to synchronize issues between two Jira projects:
1.  **User Project (Operations):** User-facing project for logging bugs, comments, and requests.
2.  **Dev Project (Development):** Internal project for developers to handle issues.

The service ensures that status changes, comments, and descriptions are synchronized bi-directionally based on specific workflows, keeping stakeholders in both projects aligned.

## Architecture
*   **Language:** TypeScript (Node.js 18+)
*   **Database:** MongoDB (via Mongoose) for storing sync state and mapping between User and Dev issues.
*   **Jira Client:** `jira.js` for interacting with Jira REST APIs.
*   **Scheduling:** `node-cron` for periodic synchronization cycles.
*   **Logging:** `pino` for structured logging.

### Key Directories
*   `src/index.ts`: Application entry point.
*   `src/config`: Configuration and environment variable validation.
*   `src/jira`: Jira API wrappers and client instantiation.
*   `src/sync`: Core synchronization logic (User -> Dev, Dev -> User, Status Monitoring).
*   `src/db`: Mongoose models (`IssueMap`, `SyncState`) and repository functions.
*   `scripts/`: Utility scripts for initial setup, testing authentication, and debugging.

## Setup & Configuration

### Prerequisites
*   Node.js 18+
*   MongoDB (local or remote)
*   Jira Account (Cloud or Data Center) with appropriate permissions.

### Environment Variables
Copy `.env.example` to `.env` and configure the following:
*   **Jira Auth:** `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` (supports Basic Auth or PAT via `JIRA_AUTH_TYPE`).
*   **Projects:** `USER_PROJECT_KEY`, `DEV_PROJECT_KEY`.
*   **Database:** `DATABASE_URL`, `DATABASE_NAME`.
*   **Sync:** `SYNC_INTERVAL_MINUTES` (default: 5).

## Building and Running

### Development
1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Start the service (using `ts-node`):**
    ```bash
    npm start
    ```
    Note: `npm start` runs `npm run build` then executes the compiled JS. For pure dev iteration without rebuilding, you might want to use `ts-node` directly or add a `dev` script.

### Production
1.  **Build:**
    ```bash
    npm run build
    ```
2.  **Run:**
    ```bash
    node dist/index.js
    ```

### Docker
The project includes a `Dockerfile` and `docker-compose.yml`.
```bash
docker-compose up -d
```
This starts the application and a MongoDB container.

## Key Scripts
*   `npm run sync:init`: Performs an initial scan to cache the User Project's state without creating new Dev issues. Useful for first-time setup on existing projects.
*   `npm run test:auth`: Verifies Jira credentials.
*   `npm run test:list-user-project`: Lists issues from the User Project to verify connectivity and query correctness.
*   `npm run test:sync-cycle`: Runs a single sync cycle for testing purposes.

## Synchronization Workflow
For a detailed visual guide, refer to [Workflow.md](Workflow.md).

**Summary:**
*   **User -> Dev:** When a User Issue is moved to `Will Do`, a corresponding Dev Issue is created in `To Do`.
*   **Dev -> User:**
    *   Dev `In Progress` -> User `In Progress`
    *   Dev `Done` -> User `Resolved`
    *   Dev `Cancelled` -> User `Cancelled`
    *   Dev `Reopened` -> User `Reopened`
*   **Comments & Descriptions:** Updates are synced to ensure context is shared.

## Development Conventions
*   **Type Safety:** Strict TypeScript configuration is used. Ensure `npm run lint` passes.
*   **Imports:** Uses NodeNext module resolution. Import local files with the `.js` extension (e.g., `import { x } from './file.js'`).
*   **Logging:** Use the global `logger` instance (`src/config/index.ts`) instead of `console.log`.
