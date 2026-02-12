# Proposal: Fix File Polyfill for Jira Attachments

## Summary
Inject a global `File` polyfill in the worker process to enable `jira.js` attachment uploads in Node.js environments (specifically Node 18).

## Problem
The `jira.js` library relies on the global `File` API (standard in browsers and Node 20+) to handle file uploads. In Node.js 18, this API is missing, causing a `ReferenceError: File is not defined` when attempting to sync attachments.

## Solution
Add a polyfill for `File` (extending `Blob`) in the worker entry point (`src/sync/worker.ts`) before any Jira client instantiation. This ensures the global `File` constructor is available for `jira.js`.

## Risks
- **Global Scope Pollution:** Modifying the global scope can theoretically conflict with other libraries, but since this is a missing standard API in an older Node version, it is a safe polyfill.
- **Maintenance:** If the project upgrades to Node 20+, this polyfill becomes redundant (but harmless if implemented with a check).
