# Proposal: Cleanup Project

**Change ID:** `cleanup-project`

## Why

The project contains redundant files and documentation that are either duplicated or no longer needed:

1. **scripts/ folder** - Contains TypeScript scripts that duplicate npm script functionality (e.g., `initial-sync.ts` duplicates `npm run sync:init`)
2. **GEMINI.md** - Duplicate of README.md content, created during AI-assisted development
3. **Workflow.md** - Documentation that should be consolidated into the main README for single-source-of-truth

## What Changes

### Removed Files
- `scripts/` - All test and sync utility scripts
- `GEMINI.md` - Redundant documentation
- `Workflow.md` - Redundant workflow documentation

### Modified Files
- `.gitignore` - Add any missing patterns if needed

## Requirements

### Cleanup Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| REQ-001 | Remove scripts folder | Delete `scripts/` directory and its contents |
| REQ-002 | Remove duplicate docs | Delete `GEMINI.md` and `Workflow.md` |
| REQ-003 | Verify npm scripts | Confirm npm commands still work without scripts folder |
| REQ-004 | Update documentation | Merge useful content from deleted files into README.md |

## Validation

- All npm scripts (`npm run sync:init`, `npm run test:auth`, etc.) continue to work
- No runtime errors from missing scripts
- README.md contains essential workflow information
