<p align="center">
  <h1 align="center">aik-mcp</h1>
  <p align="center">
    <em>AI Knowledge Repository — MCP Server</em>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/@headwood/aik-mcp"><img src="https://img.shields.io/npm/v/@headwood/aik-mcp?style=flat-square&logo=npm" alt="npm version"></a>
    <a href="https://github.com/openhoat/aik-mcp/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/openhoat/aik-mcp/ci.yml?branch=main&style=flat-square&logo=github&label=CI" alt="CI"></a>
    <a href="https://github.com/openhoat/aik-mcp/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@headwood/aik-mcp?style=flat-square" alt="license"></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/node/v/@headwood/aik-mcp?style=flat-square" alt="node version"></a>
    <a href="https://github.com/openhoat/aik-mcp"><img src="https://img.shields.io/github/last-commit/openhoat/aik-mcp?style=flat-square&logo=git" alt="last commit"></a>
    <a href="https://github.com/openhoat/aik-mcp/issues"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs welcome"></a>
  </p>
</p>

**aik-mcp** is an [MCP](https://modelcontextprotocol.io) server that turns a directory of Markdown files into a queryable knowledge base for any MCP-compatible AI agent — opencode, Claude Code, Cline, and others.

Write rules, skills, workflows, and templates as plain Markdown files with frontmatter. Your AI agent can then discover, read, search, and install them at runtime.

## Table of Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Client configuration](#client-configuration)
  - [opencode](#opencode)
  - [Claude Code](#claude-code)
  - [Cline](#cline)
- [Environment](#environment)
- [CLI options](#cli-options)
- [MCP tools](#mcp-tools)
- [Resources](#resources)
- [Content structure](#content-structure)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
# Run directly (no install)
npx aik-mcp

# Install globally
npm install -g aik-mcp
aik-mcp

# From a local build
git clone https://github.com/openhoat/aik-mcp.git
cd aik-mcp
npm install
npm run build
```

## Quick start

### 1. Create a content directory

```bash
mkdir -p my-knowledge/rules my-knowledge/skills my-knowledge/workflows
```

### 2. Add a rule

```bash
cat > my-knowledge/rules/typescript.md << 'EOF'
---
title: TypeScript Conventions
description: Coding standards for TypeScript projects
tags: [typescript, conventions]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

# TypeScript Conventions

- Use explicit types for public API surfaces
- Prefer `interface` over `type` for object shapes
- Use `const` assertions for literal values
EOF
```

### 3. Start the server

```bash
AIK_CONTENT_DIR=./my-knowledge aik-mcp
```

### 4. Configure your AI agent

See [Client configuration](#client-configuration) below.

### 5. Ask your agent

Once connected, your agent can use tools like `aik_search` and `aik_get` to find and apply your knowledge.

## Client configuration

### opencode

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "aik": {
      "command": "npx",
      "args": ["aik-mcp"],
      "env": {
        "AIK_CONTENT_DIR": "/path/to/your/content",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json` (or `~/.claude/settings.json` for global use):

```json
{
  "mcpServers": {
    "aik": {
      "command": "npx",
      "args": ["aik-mcp"],
      "env": {
        "AIK_CONTENT_DIR": "/path/to/your/content",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Cline

Add to your `cline.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "aik": {
      "command": "npx",
      "args": ["aik-mcp"],
      "env": {
        "AIK_CONTENT_DIR": "/path/to/your/content",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

> **Tip:** Set `AIK_CONTENT_DIR` to a shared location (Dropbox, git repo, etc.) to use the same knowledge base across projects and agents.

## Environment

| Variable | Description |
| --- | --- |
| `AIK_CONTENT_DIR` | Path to the content directory (default: current working directory) |
| `LOG_LEVEL` | Log level: `trace`, `debug`, `info`, `warn`, `error`, `silent` (default: `info`) |

## CLI options

| Flag | Description |
| --- | --- |
| `--http` | Start in HTTP mode (default: stdio) |
| `--port <n>` | HTTP port (default: 3456) |
| `--no-watch` | Disable file watching |

## MCP tools

| Tool | Description |
| --- | --- |
| `aik_list` | List content items, optionally filtered by category or tag |
| `aik_get` | Retrieve a specific item by path (e.g. `rules/typescript`) |
| `aik_search` | Full-text fuzzy search across all content |
| `aik_write` | Create or update a content item |
| `aik_delete` | Delete a content item |
| `aik_install` | Install an item into the project's agent config |
| `aik_reinstall` | Uninstall + reinstall the latest version of an item |
| `aik_uninstall` | Remove an installed item from the project |
| `aik_uninstall_all` | Remove all aik-installed items from the project |
| `aik_list_installed` | List items currently installed in the project |

### Resources

- `aik://{category}` — list items in a category (e.g. `aik://rules`)
- `aik://search?q=...` — search items by keyword

### When working on a task

1. Use `aik_list` or `aik_search` to find relevant content
2. Use `aik_get` to read specific items
3. Apply the relevant rules, follow the workflows, and invoke skills as needed

## Content structure

Content items are organized by category:

| Directory | Content |
| --- | --- |
| `rules/` | Coding standards, workflows, conventions |
| `skills/` | Reusable instruction blocks |
| `workflows/` | Multi-step workflow definitions |
| `agents/` | Specialized agent definitions |
| `commands/` | Custom command definitions |
| `templates/` | Project/component templates |

### Adding content

Create a `.md` file with frontmatter in the appropriate category directory:

```yaml
---
title: "My Rule"
description: "Description of the rule"
tags: [tag1, tag2]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

# My Rule

Content here...
```

## Development

```bash
npm install
npm run build
npm run test
npm run qa
```

### Commands reference

| Script | Description |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run Jest test suite |
| `npm run qa` | Lint + format check (Biome + markdownlint) |
| `npm run qa:fix` | Auto-fix lint and formatting issues |
| `npm run validate` | Run qa + build + test (same as CI) |

## Contributing

Contributions are welcome! Please open an [issue](https://github.com/openhoat/aik-mcp/issues) or submit a PR.

See the [changelog](https://github.com/openhoat/aik-mcp/releases) for release history.

## License

MIT
