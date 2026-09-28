# Changelog

All notable changes to Task Manager will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- Archive and Restore actions on every task card, and an "Archive done" toolbar action that archives completed tasks in the current project or across the board in one write.

### Fixed

- A newly created task is revealed after saving: filters that would hide it are cleared, the board scrolls to its card, and the card is labeled "Just added".
- Toolbar stage filters wrap at desktop widths instead of overflowing past the edge of the surface.

## [1.0.0] - 2026-09-14

### Added

- First release candidate of Task Manager for Paseo v0.8.0.
- User-created project management with support for multiple active projects.
- Configurable stage pipelines with custom ordering, renaming, and done stage resolution.
- Task CRUD operations with priority levels (P0 through P3), categories, due dates, specifications, notes, and links.
- Task filtering by project, stage, keyword search, and archive state.
- In-memory and on-disk atomic persistence backed by `~/.paseo/plugin-data/paseo-task-manager/`.
- Owner-only board, preferences, source settings, and preserved corrupt-file backups.
- Task attachment source integration for Paseo composer message attachments.
- Explicit agent launch workflow with workspace discovery and provider selection.
- Optional read-only external task source support with documented wire contract.
- Comprehensive test suite covering board models, storage durability, and external task ingestion.
- Actual component screenshots using synthetic data at desktop and compact widths in light and dark themes.

### Fixed

- RPC names now satisfy the Paseo runtime naming rules.
- Mutation snapshots retain tasks from other projects and archived tasks.
- Compact header controls wrap without clipping, and project tabs no longer stretch vertically.
- Completed tasks retain readable text and controls instead of dimming the entire card.
- Checkbox checked state uses cross-platform ARIA properties that survive the Paseo client boundary.
- Privacy checks include lockfiles and report matched pattern names without exposing values.
- Release preparation validates complete semver values, matching lockfiles, and reviewed changelog entries.
