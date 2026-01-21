# Proposal: Simplify Deployment - Keep Only Consolidated

**Change ID:** `simplify-deployment`

## Why

Currently the project supports two deployment methods:
- **Multi-instance**: N containers + N MongoDB containers
- **Consolidated**: 1 container + 1 MongoDB container with multiple databases

Having two deployment options creates confusion, maintenance overhead, and duplicated documentation. The consolidated approach is simpler, more resource-efficient, and sufficient for most use cases.

## What Changes

### Removed Files
- `docker-compose.multi.yml` - Multi-instance compose file
- `.env.multi.example` - Multi-instance environment template
- `config/sync-rules.example.json` - Redundant with consolidated approach

### Renamed Files
- `docker-compose.consolidated.yml` → `docker-compose.yml`
- `.env.consolidated.example` → `.env.example`

### Updated Documentation
- `DEPLOY.md` - Remove multi-instance sections, keep consolidated only
- `README.md` - Update deployment instructions

### Updated OpenSpec
- Remove `docker-config` spec (which was based on multi-instance)
- Add/update `consolidated-config` spec

## Requirements

### REQ-001: Single Deployment Method

The project SHALL provide only one deployment method: consolidated (1 container + 1 MongoDB).

### REQ-002: Simplified Configuration

The system SHALL load sync configurations from the `config/` directory.

### REQ-003: Database per Sync Pair

Each sync pair SHALL use a separate database on a shared MongoDB instance.

## Validation

- Only one docker-compose.yml file exists
- All config files are in `config/` directory
- DEPLOY.md contains only consolidated deployment instructions
