# Proposal: Remove MongoDB Configuration Dependency

**Change ID:** `remove-mongodb-config`

**Status:** Approved

**Created:** 2026-01-21

**Approved:** 2026-01-21

**Implemented:** 2026-01-21

**User Request:** "xoá bỏ cấu hình flow với mongodb"

## Summary

Remove the MongoDB-based configuration storage for sync flow rules. The current implementation stores sync configuration in the `sync_flow_config` MongoDB collection, which adds complexity without providing significant value for most use cases. This proposal simplifies the system by using only the embedded default configuration.

## Why

The MongoDB configuration storage has several drawbacks:

1. **Complexity**: Requires database access to manage configurations
2. **No Version Control**: Changes are not tracked or reviewable
3. **Operational Overhead**: Need to manage `sync_flow_config` collection
4. **Inflexible**: Hard to backup/restore individual configurations

For most teams, the default configuration is sufficient. Power users who need custom configurations can:
- Fork the project and modify the default config
- Use environment variables for simple overrides
- Request a file-based configuration as a future enhancement

## What Changes

### Files Removed

- `src/db/sync-config-repo.ts`: Remove the repository class entirely
- `SyncFlowConfigModel` from `src/db/models.ts`: Remove the schema and model

### Files Modified

- `src/sync/config-loader.ts`: Simplify to always return embedded default config
- `src/scheduler.ts`: Update import (no functional change)

### Configuration Approach

After this change, the sync flow configuration will be:

1. **Embedded Default**: The default configuration is hardcoded in `config-loader.ts`
2. **No Database Dependency**: `sync_flow_config` collection is no longer used
3. **Simple and Predictable**: Same behavior every time
4. **Future Extensibility**: File-based or environment-based config can be added later if needed

### Backward Compatibility

- **Breaking Change**: Existing database configurations will be ignored
- **Migration Path**: No automatic migration needed - configurations are discarded
- **Rollback**: Can revert to previous commit if needed

## Default Configuration (Unchanged)

The default configuration remains the same:

```json
{
  "name": "default",
  "rules": [
    {
      "sourceStatus": "Will Do",
      "targetProject": "dev",
      "syncDirection": "user_to_dev",
      "actions": { "createIssue": true, "syncAttachments": true }
    },
    {
      "sourceStatus": "Closed",
      "targetProject": "user",
      "targetStatus": "Resolved",
      "syncDirection": "dev_to_user",
      "actions": { "syncStatus": true }
    }
  ]
}
```

## Comparison

| Aspect | Before (MongoDB) | After (Embedded) |
|--------|------------------|------------------|
| Config Storage | MongoDB `sync_flow_config` | Hardcoded in code |
| Edit Config | Requires DB access | Fork and modify code |
| Version Control | No | Yes (git) |
| Backup | MongoDB dump | File copy of repo |
| Startup Dependency | MongoDB | None |

## Dependencies & Risks

### Dependencies
- None - this change removes a dependency

### Risks
- **Breaking Change**: Teams using custom database configurations will lose them
- **No Runtime Customization**: Cannot change sync rules without code changes
- **Future Feature Loss**: Database-based features (config versioning, multi-config) need reimplementation if needed

## Timeline

- **Phase 1**: Remove SyncConfigRepository (0.25 day)
- **Phase 2**: Simplify ConfigLoader (0.25 day)
- **Phase 3**: Remove model and update imports (0.25 day)
- **Phase 4**: Build and verify (0.25 day)

**Total Estimate:** 1 day
