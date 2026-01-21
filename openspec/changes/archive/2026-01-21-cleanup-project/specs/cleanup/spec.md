# Spec: Project Cleanup

## ADDED Requirements

### Requirement: Remove Scripts Folder

The `scripts/` directory and all its contents SHALL be removed from the project.

**Rationale:** Scripts in `scripts/` duplicate npm command functionality, causing maintenance burden.

#### Scenario: Scripts folder deletion

**Given** the project contains a `scripts/` directory
**When** the cleanup change is applied
**Then** the `scripts/` directory shall no longer exist
**And** `ls scripts/` shall return an error

#### Scenario: npm scripts still functional

**Given** the cleanup change has been applied
**When** running `npm run sync:init`
**Then** the command shall execute successfully
**And** `npm run test:auth` shall execute successfully
**And** `npm run test:list-user-project` shall execute successfully
**And** `npm run test:sync-cycle` shall execute successfully

### Requirement: Remove Duplicate Documentation

The files `GEMINI.md` and `Workflow.md` SHALL be removed from the project.

**Rationale:** Documentation is duplicated across multiple files, making maintenance harder.

#### Scenario: Duplicate docs deletion

**Given** the project contains `GEMINI.md` and `Workflow.md`
**When** the cleanup change is applied
**Then** both files shall no longer exist
**And** `ls GEMINI.md Workflow.md` shall return errors

### Requirement: Merge Documentation to README

Essential workflow documentation from deleted files SHALL be merged into `README.md`.

**Rationale:** Single source of truth for documentation improves maintainability.

#### Scenario: Workflow content merged

**Given** the cleanup change has been applied
**When** reading `README.md`
**Then** it shall contain a synchronization workflow section
**And** it shall contain key commands documentation
**And** it shall contain project setup instructions

#### Scenario: README remains valid

**Given** the cleanup change has been applied
**When** reading `README.md`
**Then** it shall be valid markdown
**And** all links and references shall be accurate

### Requirement: Documentation Location Consolidation

Documentation SHALL exist in a single location (`README.md`) instead of multiple files.

**Rationale:** Consolidating documentation improves maintainability.

#### Scenario: Documentation consolidation

**Given** the project before cleanup
**And** documentation exists in multiple files
**When** the cleanup change is applied
**Then** all essential documentation shall exist in `README.md`
**And** no duplicate documentation files shall remain

## REMOVED Requirements

- The requirement for a `scripts/` directory shall be removed.

**Rationale:** npm scripts provide the same functionality without duplication.

#### Scenario: Scripts directory removed

**Given** the project has a `scripts/` directory
**When** the cleanup change is applied
**Then** the directory and its contents shall be deleted
**And** no scripts shall exist outside of npm commands
