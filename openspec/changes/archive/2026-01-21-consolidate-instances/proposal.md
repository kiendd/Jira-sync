# Proposal: Consolidate Multiple Sync Instances

**Change ID:** `consolidate-instances`

## Why

Currently, running multiple sync instances requires:
- Multiple Docker containers (1 per sync pair)
- Multiple MongoDB containers (1 per instance)
- High resource usage (CPU, memory, disk)

This approach is inefficient when scaling to many sync pairs.

## What Changes

### Architecture Change

**From:** N containers + N MongoDB containers for N sync pairs
**To:** 1 container + 1 MongoDB container with N databases for N sync pairs

### Key Changes

1. **Single Container, Multiple Processes**: Use Node.js child processes to run multiple sync jobs in one container
2. **Shared MongoDB Instance**: One MongoDB container serving multiple databases (1 per sync pair)
3. **Multi-config Support**: Load multiple JSON config files for different sync pairs
4. **Dynamic Config Loading**: Config loader scans config directory and spawns worker for each

## Requirements

### REQ-001: Multi-Config Support

The system SHALL load multiple sync configuration files from a config directory.

### REQ-002: Child Process Management

The main process SHALL spawn a child process for each sync pair configuration.

### REQ-003: Isolated Database per Pair

Each sync pair SHALL use a separate MongoDB database on the shared MongoDB instance.

### REQ-004: Independent Scheduling

Each child process SHALL run its own scheduler with configurable interval.

## Validation

- Single container runs all sync pairs
- MongoDB memory usage reduced (1 instance vs N instances)
- Each sync pair operates independently
