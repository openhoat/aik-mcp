# Contributing

## Setup

```bash
git clone https://github.com/openhoat/aik-mcp.git
cd aik-mcp
npm ci
```

## Development

```bash
# Run all checks (lint, typecheck, build, test)
npm run validate

# Auto-fix linting and formatting
npm run qa:fix

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Project structure

```text
src/              # MCP server source code
scripts/          # Build and maintenance scripts
docs/             # VitePress documentation site
rag/agents/       # Scraped agent documentation for RAG
```

## Code conventions

- TypeScript with strict mode
- Arrow functions over `function` declarations
- No `any` type — use `unknown` or specific types
- No `as` type assertions without a justifying comment
- Structured logging with pino (no `console.log` in production)
- Custom error classes with `code` and `cause`

## Commit conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`, `revert`

## Pull request workflow

1. Create a branch from `main` (`feat/`, `fix/`, `chore/`, etc.)
2. Make your changes in a git worktree
3. Run `npm run validate` before committing
4. Open a PR with a clear description
5. Squash-merge or rebase-merge into `main`

## Release

```bash
npm version patch  # or minor, major
```

This runs validation, generates the changelog, creates a git tag, and pushes automatically. The CI pipeline publishes to npm and creates a GitHub release.
