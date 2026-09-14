# Changelog

All notable changes to Task Manager will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [1.0.0] - 2026-09-14

### Added

- Initial public release of Task Manager for Paseo v0.8.0.
- User-created project management with support for multiple active projects.
- Configurable stage pipelines with custom ordering, renaming, and done stage resolution.
- Task CRUD operations with priority levels (P0 through P3), categories, due dates, specifications, notes, and links.
- Task filtering by project, stage, keyword search, and archive state.
- In-memory and on-disk atomic persistence backed by `~/.paseo/plugin-data/paseo-task-manager/`.
- Automatic repair and non-destructive fallback for damaged board files.
- Task attachment source integration for Paseo composer message attachments.
- Explicit agent launch workflow with workspace discovery and provider selection.
- Optional read-only external task source support with documented wire contract.
- Comprehensive test suite covering board models, storage durability, and external task ingestion.
- Synthetic screenshot generation harness across desktop, compact, light, and dark viewports.
