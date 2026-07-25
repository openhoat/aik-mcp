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

## Agent Documentation RAG

Scraped agent documentation for local RAG indexing. The scraper fetches pages from the official documentation sites of opencode, Claude Code, and Cline, converts them to Markdown, and stores them in `rag/agents/`.

### Scrape Documentation

```bash
npm run scrape:agent-docs
```

This fetches ~10 pages per agent and writes them to `rag/agents/<agent>/<page>.md` with YAML frontmatter (`title`, `source`, `scraped_at`).

### Configure local-rag MCP Server

Point `mcp-local-rag` at the `rag/agents` directory to make the documentation queryable by AI agents:

```jsonc
{
  "mcpServers": {
    "local-rag": {
      "type": "local",
      "command": ["npx", "-y", "mcp-local-rag"],
      "enabled": true,
      "timeout": 120000,
      "environment": {
        "BASE_DIR": "./rag"
      }
    }
  }
}
```

### Querying Agent Docs

Once configured, agents can query the RAG index to understand native formats. For example:

> "Search the RAG for opencode rules format"
> "Search the RAG for claude-code memory configuration"
> "Search the RAG for cline plugin setup"

### Pages by Agent

| Agent       | Pages                                                                                                         |
|-------------|---------------------------------------------------------------------------------------------------------------|
| opencode    | intro, overview, rules, skills, agents, commands, config, mcp-servers, permissions, tools                     |
| claude-code | overview, memory, skills, hooks, sub-agents, settings, mcp, permissions, best-practices, common-workflows     |
| cline       | overview, rules, skills, plugins, config, using-commands, subagents, mcp-overview, memory-bank, cli-reference |
| codex       | overview, quickstart, prompting, customization, memories, sandboxing, subagents, workflows, app, ide, cli, config, permissions, rules, hooks, agents-md, mcp, plugins, skills, best-practices, enterprise, and more (43 pages) |
| copilot     | custom-instructions, repository-instructions, agent-instructions                                              |

### Output Structure

```text
rag/
└── agents/
    ├── opencode/
    │   ├── intro.md
    │   ├── overview.md
    │   ├── rules.md
    │   └── ...
    ├── claude-code/
    │   ├── overview.md
    │   ├── memory.md
    │   └── ...
    ├── cline/
    │   ├── overview.md
    │   ├── rules.md
    │   └── ...
    ├── codex/
    │   ├── overview.md
    │   ├── quickstart.md
    │   ├── rules.md
    │   ├── config-basics.md
    │   └── ... (43 pages)
    └── copilot/
        ├── custom-instructions.md
        ├── repository-instructions.md
        └── agent-instructions.md
```

Each file includes frontmatter with the original source URL and scrape timestamp, making it easy to refresh individual pages when docs change.

### Regeneration

The `rag/` directory is gitignored. Regenerate at any time:

```bash
npm run scrape:agent-docs
```
