# Proposal: Sync Configuration File

**Change ID:** `sync-config-file`

**Status:** Draft

**Created:** 2026-01-21

**User Request:** "configure tôi không muốn định nghĩa trong database, mỗi lần thay đổi rất bất tiện, tôi muốn chuyển dùng file json"

## Summary

Change sync configuration storage from MongoDB to JSON file. Currently, the `configure-sync-flow` implementation stores sync rules in the `sync_flow_config` MongoDB collection, requiring database access to modify configurations. This proposal moves configuration to a local JSON file for easier editing and version control.

## Why

The current database-based configuration is inconvenient for operators:
- Requires MongoDB access to edit (CLI, GUI, or API)
- No version control for configuration changes
- No diff capability to review changes
- Requires service restart or config reload mechanism to pick up changes
- Hard to backup/restore configurations

File-based configuration provides:
- Easy editing with any text editor
- Git version control and diff
- Simple backup (just copy the file)
- Immediate changes on next service start
- Familiar workflow for developers

## What Changes

1. **New Config File**: `config/sync-rules.json` (or `sync-flow-config.json`)
2. **Modified ConfigLoader**: Load from file system instead of MongoDB
3. **Removed Components**: `SyncConfigRepository` and `sync_flow_config` collection
4. **Updated Scheduler**: File loaded at startup and on each sync cycle

### Files Changed

- `src/sync/config-loader.ts`: Change to read from file system
- `src/db/sync-config-repo.ts`: Remove or deprecate
- `src/scheduler.ts`: Update to use file-based config
- `config/sync-rules.json`: New file with sync rules (example)

### Backward Compatibility

- Default configuration embedded in code as fallback
- If file is missing or invalid, use embedded defaults
- Existing deployments can migrate by exporting current config to JSON

## Configuration File Location

Option 1: `config/sync-rules.json` - alongside other config files
Option 2: `sync-flow-config.json` - project root
Option 3: Path configurable via environment variable `SYNC_CONFIG_PATH`

**Recommended:** Option 3 with default to `config/sync-rules.json`

## File Format

```json
{
  "name": "default",
  "userProjectKey": "USER",
  "devProjectKey": "DEV",
  "defaultBehavior": {
    "syncAttachments": true,
    "addCrossLinks": true,
    "onlyOnStatusChange": true,
    "skipIntermediateStatuses": true
  },
  "rules": [
    {
      "sourceStatus": "Will Do",
      "targetProject": "dev",
      "syncDirection": "user_to_dev",
      "enabled": true,
      "actions": {
        "createIssue": true,
        "syncAttachments": true,
        "addCrossLink": true,
        "addComment": true,
        "commentTemplate": "Đã tạo Dev Issue: ${targetKey}"
      }
    }
  ]
}
```

## Migration from Database Config

To migrate existing database configuration:

1. Query `sync_flow_config` collection
2. Export to JSON format
3. Save to `config/sync-rules.json`
4. Remove document from database (optional)

## Comparison

| Aspect | Database | File (This Proposal) |
|--------|----------|---------------------|
| Editing | Requires DB access | Any text editor |
| Version Control | No | Yes (git) |
| Diff Changes | Hard | Easy |
| Backup | MongoDB dump | File copy |
| Change Detection | Need mechanism | File mtime |
| Multi-instance | Centralized | Each instance |

## Dependencies & Risks

### Dependencies
- File system read access
- JSON parsing

### Risks
- File path configuration errors
- Permission issues reading file
- JSON syntax errors

## Timeline

- **Phase 1**: Create JSON config file and example (0.25 day)
- **Phase 2**: Refactor ConfigLoader to read from file (0.5 day)
- **Phase 3**: Update scheduler and remove DB dependency (0.25 day)
- **Phase 4**: Update documentation (0.25 day)

**Total Estimate:** 1.25 days
