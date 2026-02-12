# sync-attachments Specification

## ADDED Requirements

### Requirement: Runtime Environment Support

The attachment synchronization MUST function correctly in the target Node.js runtime (Node 18), providing necessary polyfills for missing Web APIs used by dependencies.

#### Scenario: File API Availability
- Given the application is running in Node.js 18
- When `jira.js` attempts to create a `File` object for an attachment
- Then the `File` constructor must be available in the global scope
- And the attachment upload should proceed without `ReferenceError`.
