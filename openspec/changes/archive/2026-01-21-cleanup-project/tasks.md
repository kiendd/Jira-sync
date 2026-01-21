# Tasks: Cleanup Project

**Change ID:** `cleanup-project`

**Total Estimate:** 0.25 day

## TASK-001: Delete Scripts Folder
- **Estimate:** 0.1 day
- **Status:** Pending
- **Description:** Delete `scripts/` folder and all its contents
- **Validation:** Folder no longer exists, `ls scripts/` returns error
- **Dependencies:** None

## TASK-002: Delete Duplicate Documentation
- **Estimate:** 0.05 day
- **Status:** Pending
- **Description:** Delete `GEMINI.md` and `Workflow.md`
- **Validation:** Files no longer exist
- **Dependencies:** TASK-003

## TASK-003: Merge Useful Content to README
- **Estimate:** 0.1 day
- **Status:** Pending
- **Description:** Review GEMINI.md and Workflow.md, merge useful workflow sections into README.md
- **Validation:** README.md contains sync workflow diagram and essential commands
- **Dependencies:** TASK-002

## TASK-004: Verify npm Scripts Still Work
- **Estimate:** 0.05 day
- **Status:** Pending
- **Description:** Test that `npm run sync:init`, `npm run test:auth`, `npm run test:list-user-project`, and `npm run test:sync-cycle` all work
- **Validation:** All npm scripts execute successfully
- **Dependencies:** TASK-001

## Dependency Graph

```
TASK-001 ──> TASK-004
   │
   └──> TASK-002 ──> TASK-003 ──> (integrated into README)
```

## Validation Commands

```bash
# Verify scripts folder deleted
ls scripts/ 2>&1 | grep "No such file"

# Verify docs deleted
ls GEMINI.md Workflow.md 2>&1 | grep "No such file"

# Test npm scripts
npm run sync:init -- --help 2>&1 | head -5
npm run test:auth 2>&1 | head -5

# Verify README content
grep -q "## Synchronization Workflow" README.md && echo "README has workflow section"
```

## File Structure

After implementation:

```
├── README.md              <- Updated with merged content
├── GEMINI.md              <- Deleted
├── Workflow.md            <- Deleted
├── scripts/               <- Deleted
└── .gitignore             <- Updated if needed
```
