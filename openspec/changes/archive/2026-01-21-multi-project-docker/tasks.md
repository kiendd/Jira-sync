# Tasks: Multi-Project Docker Configuration

**Change ID:** `multi-project-docker`

**Total Estimate:** 1 day

## TASK-001: Create Example Config File
- **Estimate:** 0.25 day
- **Status:** Done
- **Description:** Create `config/sync-rules.example.json` with all available options and comments
- **Validation:** File exists, valid JSON, includes all rule types
- **Dependencies:** None

## TASK-002: Create Multi-Instance Docker Compose
- **Estimate:** 0.5 day
- **Status:** Done
- **Description:** Create `docker-compose.multi.yml` with two instance examples (project-ab, project-cd)
- **Validation:** File is valid YAML, can be parsed by docker-compose
- **Dependencies:** TASK-001

## TASK-003: Create Environment Template
- **Estimate:** 0.1 day
- **Status:** Done
- **Description:** Create `.env.multi.example` with all required variables for multi-instance setup
- **Validation:** All required variables are documented
- **Dependencies:** TASK-002

## TASK-004: Update Docker Compose Documentation
- **Estimate:** 0.1 day
- **Status:** Done
- **Description:** Add comments to `docker-compose.yml` pointing to multi-instance version
- **Validation:** Documentation is clear and helpful
- **Dependencies:** TASK-002

## TASK-005: Validate YAML Syntax
- **Estimate:** 0.05 day
- **Status:** Done
- **Description:** Run docker-compose config to validate YAML syntax
- **Validation:** docker-compose -f docker-compose.multi.yml config passes
- **Dependencies:** TASK-002, TASK-003

## Dependency Graph

```
TASK-001 ──┐
           │
TASK-002 ──┼──> TASK-003 ──> TASK-004
           │                │
           └────> TASK-05 ─┘
```

## Validation Commands

```bash
# Validate docker-compose syntax
docker-compose -f docker-compose.multi.yml config

# Validate JSON syntax
cat config/sync-rules.example.json | python3 -m json.tool > /dev/null

# List all containers
docker-compose -f docker-compose.multi.yml ps
```

## File Structure

After implementation:

```
├── config/
│   └── sync-rules.example.json  <- New file
├── docker-compose.yml           <- Updated with comments
├── docker-compose.multi.yml     <- New file
├── .env.multi.example           <- New file
└── .env.example                 <- Updated with notes
```

## Usage Instructions

### Quick Start (Single Instance)
```bash
cp .env.example .env
# Edit .env with your values
docker-compose up -d
```

### Multi-Instance
```bash
cp .env.multi.example .env.multi
# Edit .env.multi with your values
docker-compose -f docker-compose.multi.yml up -d
```

### Add New Instance
1. Copy instance block in `docker-compose.multi.yml`
2. Update container name, ports, volumes
3. Add variables to `.env.multi`
4. Create config file in `config/`
