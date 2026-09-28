# Contributing to Task Manager

Thank you for your interest in improving Task Manager.

## Development Workflow

1. Ensure Node.js 24 or newer is installed.
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Run tests and typechecking:
   ```bash
   npm test
   npm run typecheck
   ```
4. Run full repository verification before submitting changes:
   ```bash
   npm run verify
   ```

## Ground Rules

- Keep PRs focused on a single concern.
- Do not commit private client data, personal paths, credentials, or private network addresses.
- Ensure all tests pass and `npm run verify` succeeds.
- Do not use em dashes in documentation, commit messages, or comments. Use commas, colons, parentheses, or separate sentences instead.
- If introducing user-facing changes, update `CHANGELOG.md` under an `[Unreleased]` section.
