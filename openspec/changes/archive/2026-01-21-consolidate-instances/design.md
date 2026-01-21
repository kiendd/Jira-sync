# Design: Consolidate Multiple Sync Instances

## Overview

Consolidate multiple sync instances into a single container using Node.js child processes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    jira-sync Container                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Main Process (Node.js)                   │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │   │
│  │  │ Config      │ │ Process     │ │ Health      │        │   │
│  │  │ Loader      │ │ Manager     │ │ Monitor     │        │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
│           │                   │                   │             │
│           ▼                   ▼                   ▼             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Child Processes (Workers)                   │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │   │
│  │  │ Worker AB   │ │ Worker CD   │ │ Worker XY   │        │   │
│  │  │ (sync-ab)   │ │ (sync-cd)   │ │ (sync-xy)   │        │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           │
           │ DATABASE_URL=mongodb://mongo:27017
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    mongo Container                               │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ sync_ab     │ │ sync_cd     │ │ sync_xy     │  <- Databases │
│  │ (Database)  │ │ (Database)  │ │ (Database)  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Trade-offs

### Multi-Container vs Single Container

| Aspect | Multi-Container (Current) | Single Container (Proposed) |
|--------|---------------------------|----------------------------|
| Containers | N sync + N MongoDB | 1 sync + 1 MongoDB |
| Memory | O(N) | O(1) |
| Disk | O(N) volumes | O(1) volume |
| Isolation | Complete | Partial (shared process) |
| Scaling | Horizontal | Vertical |
| Complexity | Simple config | Complex process management |

### Process Models

| Model | Pros | Cons |
|-------|------|------|
| Child Processes (chosen) | Good isolation, separate event loops | Higher memory per process |
| Worker Threads | Shared memory, lower memory | Complex shared state |
| PM2 Cluster | Process supervision built-in | External dependency |

### Database Strategy

| Strategy | Pros | Cons |
|----------|------|------|
| Separate DBs (chosen) | Clean isolation, easy backup | More connections |
| Shared DB + Prefix | Single DB, fewer connections | Complex queries, risk of collision |

## Implementation Strategy

### Phase 1: Config Loader Updates
- Scan config directory for `*.json` files
- Parse and validate each config
- Return array of sync configurations

### Phase 2: Process Manager
- Spawn worker process for each config
- Use `child_process.fork()` for Node.js workers
- Implement message passing for status/health
- Handle process crashes and restarts

### Phase 3: Worker Implementation
- Each worker gets its own config and database name
- Worker runs independent scheduler
- Worker sends heartbeat to main process

### Phase 4: Docker Compose
- Single `jira-sync` service
- Single `mongo` service
- Mount all config files
- Environment variable for config directory
