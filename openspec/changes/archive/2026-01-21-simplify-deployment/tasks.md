# Tasks: Simplify Deployment - Keep Only Consolidated

**Change ID:** `simplify-deployment`

**Total Estimate:** 0.5 day

## TASK-001: Remove Multi-Instance Files
- **Estimate:** 0.1 day
- **Status:** Done
- **Description:** Delete multi-instance compose and env files
- **Validation:** Files no longer exist
- **Dependencies:** None

## TASK-002: Rename Consolidated Files
- **Estimate:** 0.1 day
- **Status:** Done
- **Description:** Rename consolidated files to standard names
- **Validation:** Files renamed correctly
- **Dependencies:** TASK-001

## TASK-003: Update DEPLOY.md
- **Estimate:** 0.2 day
- **Status:** Done
- **Description:** Remove multi-instance sections, keep consolidated only
- **Validation:** DEPLOY.md contains only consolidated deployment
- **Dependencies:** TASK-002

## TASK-004: Update README.md
- **Estimate:** 0.05 day
- **Status:** Done
- **Description:** Update deployment instructions in README
- **Validation:** README references correct files
- **Dependencies:** TASK-003

## TASK-005: Validate and Test
- **Estimate:** 0.05 day
- **Status:** Done
- **Description:** Run lint and verify files exist
- **Validation:** All checks pass
- **Dependencies:** TASK-004

## Dependency Graph

```
TASK-001 ──> TASK-002 ──> TASK-003 ──> TASK-004 ──> TASK-005
```

## Validation Commands

```bash
# Verify only one compose file
ls docker-compose.yml

# Verify env template
ls .env.example

# Verify config example
ls config/sync-rules.example.json

# Validate compose
docker-compose config

# Run lint
npm run lint
```

## File Structure

After implementation:

```
├── docker-compose.yml              <- Single deployment file
├── .env.example                    <- Environment template
├── config/
│   └── sync-rules.example.json     <- Example config
├── DEPLOY.md                       <- Updated with consolidated only
└── README.md                       <- Updated
```

## Changes Summary

### Removed Files
- `docker-compose.multi.yml` - Multi-instance compose file
- `.env.multi.example` - Multi-instance environment template

### Renamed Files
- `docker-compose.consolidated.yml` → `docker-compose.yml`
- `.env.consolidated.example` → `.env.example`

### Updated Files
- `DEPLOY.md` - Simplified to consolidated deployment only
- `README.md` - Updated deployment reference
- `config/sync-rules.example.json` - Recreated as example config
