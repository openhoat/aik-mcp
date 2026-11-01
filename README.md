<div align="center">
  <h1 align="center">aik-mcp</h1>
</div>
<div align="center">
  <em>AI Knowledge — MCP Server</em>
</div>

<p align="center">
Give your AI agents a memory.<br>
Rules, skills, workflows, and agents — as plain Markdown, served over the Model Context Protocol.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@headwood/aik-mcp"><img src="https://img.shields.io/npm/v/@headwood/aik-mcp?style=flat-square&logo=npm" alt="npm version"></a>
  <a href="https://github.com/openhoat/aik-mcp/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/openhoat/aik-mcp/ci.yml?branch=main&style=flat-square&logo=github&label=CI" alt="CI"></a>
  <a href="https://github.com/openhoat/aik-mcp/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@headwood/aik-mcp?style=flat-square" alt="license"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/node/v/@headwood/aik-mcp?style=flat-square" alt="node version"></a>
  <a href="https://codecov.io/gh/openhoat/aik-mcp"><img src="https://codecov.io/gh/openhoat/aik-mcp/branch/main/graph/badge.svg" alt="codecov"></a>
</p>

---

**aik-mcp** turns a directory of Markdown files into a live, queryable knowledge base for any [MCP](https://modelcontextprotocol.io)-compatible AI agent — [opencode](https://opencode.ai), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Cline](https://cline.bot), [Codex](https://developers.openai.com/codex), [GitHub Copilot](https://github.com/features/copilot), and more.

Write your team's conventions, reusable workflows, and agent prompts as plain `.md` files with YAML frontmatter. **aik-mcp** serves them on demand — your agent can discover, read, search, and install them at runtime, across any project.

No database. No API to build. Just Markdown.

## Features

| Icon | Feature                   | Why it matters                                                                                 |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| 📝   | **Knowledge as Markdown** | Plain `.md` files with frontmatter. Version them with git. Review them in PRs.                 |
| ⚡   | **Zero config**           | `npx aik-mcp` runs immediately. Point it at a folder of Markdown files. Done.                  |
| 🔎   | **Full-text search**      | Fuzzy search across every rule, skill, and template — powered by [Fuse.js](https://fusejs.io). |
| 📦   | **Install on demand**     | Push knowledge directly into your agent's runtime config with a single tool call.              |
| 👀   | **Live sync**             | A file watcher detects changes instantly. No restart. No downtime.                             |
| 🔌   | **Universal MCP**         | Works with opencode, Claude Code, Cline, Codex, Copilot, and any MCP-compatible client.        |

## Quick start

### 1. Create a rule

```bash
mkdir -p my-knowledge/rules
cat > my-knowledge/rules/typescript.md << 'EOF'
---
title: TypeScript Conventions
description: Coding standards for TypeScript projects
tags: [typescript, conventions]
version: "1.0.0"
compatibility: [opencode, claude-code, cline, codex, copilot]
---

## TypeScript Conventions

- Use explicit types for public API surfaces
- Prefer `interface` over `type` for object shapes
- Use `const` assertions for literal values
EOF
```

### 2. Start the server

```bash
AIK_CONTENT_DIR=./my-knowledge npx aik-mcp
```

### 3. Ask your agent

```text
"Find and apply the TypeScript conventions rule for this project."
```

Your agent calls `aik_search`, reads the rule, and applies it — all transparently through MCP.

## Docs

Full documentation is available at **[openhoat.github.io/aik-mcp](https://openhoat.github.io/aik-mcp/)**.

## How it works

```mermaid
graph LR
    Agent[AI Agent<br>opencode / Claude Code / Cline / Codex / Copilot] -->|MCP JSON-RPC| Server(aik-mcp)
    Server --> Store[Content Store<br>in memory]
    Store --> Files[Markdown files<br>rules/ skills/ workflows/ ...]
    Server --> Watcher[File Watcher<br>live sync on change]
    Server --> Tools[MCP Tools<br>list, get, search, write,<br>install, uninstall]
```

Your agent speaks MCP on one side. **aik-mcp** speaks your file system on the other. Everything is cached in memory for fast lookups, and a file watcher keeps the cache up to date.

## Client configuration

### opencode

Add to `opencode.jsonc` or `.opencode/opencode.jsonc` in your project:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "aik": {
      "type": "local",
      "command": ["npx", "-y", "aik-mcp"],
      "enabled": true,
      "environment": {
        "AIK_CONTENT_DIR": "/path/to/your/knowledge",
        "LOG_LEVEL": "info",
      },
    },
  },
}
```

### Claude Code

Add to `.mcp.json` or `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "aik": {
      "command": "npx",
      "args": ["aik-mcp"],
      "env": {
        "AIK_CONTENT_DIR": "/path/to/your/knowledge",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Cline

Add to `cline.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "aik": {
      "command": "npx",
      "args": ["aik-mcp"],
      "env": {
        "AIK_CONTENT_DIR": "/path/to/your/knowledge",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Codex

Add to `~/.codex/config.toml` or project `.codex/config.toml`:

```toml
[mcp]
"aik" = { command = ["npx", "aik-mcp"], env = { AIK_CONTENT_DIR = "/path/to/your/knowledge", LOG_LEVEL = "info" } }
```

### GitHub Copilot

Configure the MCP server in your IDE settings (VS Code, JetBrains, etc.) and add project instructions to `.github/copilot-instructions.md`:

```markdown
## MCP servers

aik-mcp provides knowledge management. Use `aik_list`, `aik_get`, `aik_search`, `aik_install`, and related tools to manage rules, skills, workflows, and agents.
```

> **Tip:** Set `AIK_CONTENT_DIR` to a shared path (Dropbox, git repo, team NAS, etc.) to use the same knowledge base across projects and agents.

### Remote HTTP client

Run the server once, reachable over the network, and point every client at it:

```bash
MCP_API_KEY="$(openssl rand -hex 32)" AIK_CONTENT_DIR=/srv/aik-content npx aik-mcp --http --port 3456
```

The HTTP transport is **fail closed**: it refuses to start without `MCP_API_KEY`
(empty or the `change-me` placeholder is rejected), `/health` is the only public
route and every other request needs `Authorization: Bearer <key>`.

A remote server does not run on the client machine, so it cannot write the
client's agent configuration. In HTTP mode the installation tools therefore
return a **plan** — the exact files, section edits and config entries to apply —
and the client agent applies it locally with its own file tools. The bundled
instructions (`aik_knowledge_content`, served with every session) describe the
apply procedure; `GET /plan/<item>?agent=&scope=` returns the same JSON to a
shell script, for payloads too large to pass through a model, and the package
ships `aik-apply` to apply one:

```bash
curl -fsS -H "Authorization: Bearer $MCP_API_KEY" \
  "https://aik-mcp.example.com/plan/skills/generate-changelog?agent=codex&scope=project" \
  -o plan.json
aik-apply plan.json --base /path/to/project
```

See [Remote servers](docs/guide/remote-servers.md) for the whole picture (sessions,
authentication, plan application, content sync) and [Tool reference](docs/guide/tools.md)
for the mode-by-mode table.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "aik": {
        "type": "remote",
        "url": "https://aik-mcp.example.com/mcp",
        "headers": { "Authorization": "Bearer {env:MCP_API_KEY}" },
        "oauth": false,
      },
    },
  },
}
```

## Content structure

Content items are organized by category as **bundles** — a directory with a
`README.md` entry file plus optional supporting assets:

| Directory    | Purpose                                        |
| ------------ | ---------------------------------------------- |
| `rules/`     | Coding standards, conventions, quality gates   |
| `skills/`    | Reusable instruction blocks (prompts, recipes) |
| `workflows/` | Multi-step process definitions                 |
| `agents/`    | Specialized agent configurations               |

```text
content/
  skills/generate-changelog/
    README.md                 # entry file — carries the frontmatter
    assets/changelog.mjs      # supporting asset, referenced relatively
```

The `README.md` entry file is a Markdown document with YAML frontmatter:

```markdown
---
title: "My Rule"
description: "What this rule enforces"
tags: [tag1, tag2]
version: "1.0.0"
compatibility: [opencode, claude-code, cline, codex, copilot]
---

## My Rule

Content here...
```

Supporting assets are listed by `aik_get` and read via `aik_get_asset`.
When a skill is installed, its assets are copied alongside `SKILL.md`.

## MCP tools

Knowledge base tools, identical in both transports:

| Tool            | Description                                                 |
| --------------- | ----------------------------------------------------------- |
| `aik_list`      | List content items, optionally filtered by category or tag  |
| `aik_get`       | Retrieve a specific item by path (e.g. `rules/typescript`)  |
| `aik_get_asset` | Read a supporting asset bundled with an item                |
| `aik_search`    | Full-text fuzzy search across all content                   |
| `aik_write`     | Create or update a content item from the agent              |
| `aik_delete`    | Delete a content item                                       |
| `aik_layout`    | Where each agent installs each category (base, dir, format) |

Installation tools. Over stdio the server runs on the machine the content is
installed on, so it writes the files itself. Over HTTP it runs elsewhere: the
same tools return a plan the client agent applies, and the ones that can only
work locally disappear.

| Tool                 | stdio (local)                | HTTP (remote)                             |
| -------------------- | ---------------------------- | ----------------------------------------- |
| `aik_install`        | installs the item            | returns the installation plan             |
| `aik_uninstall`      | removes the item             | returns the uninstallation plan           |
| `aik_check_updates`  | reads the installed versions | compares an inventory you send            |
| `aik_reinstall`      | uninstall then install       | — (apply an uninstall plan, then install) |
| `aik_update`         | updates an installed item    | —                                         |
| `aik_list_installed` | lists installed items        | — (build the inventory from `aik_layout`) |
| `aik_uninstall_all`  | removes every installed item | —                                         |

## Resources

| URI                  | Description                                       |
| -------------------- | ------------------------------------------------- |
| `aik://{category}`   | List all items in a category (e.g. `aik://rules`) |
| `aik://search?q=...` | Search items by keyword                           |

## CLI options

| Flag         | Default | Description                             |
| ------------ | ------- | --------------------------------------- |
| `--http`     | —       | Start in HTTP/SSE mode instead of stdio |
| `--port <n>` | `3456`  | HTTP server port (only with `--http`)   |
| `--no-watch` | —       | Disable file watching                   |

## Environment variables

| Variable          | Default | Description                                                    |
| ----------------- | ------- | -------------------------------------------------------------- |
| `AIK_CONTENT_DIR` | `.`     | Path to the content directory                                  |
| `MCP_API_KEY`     | —       | Bearer key, mandatory with `--http`, refused when unset        |
| `LOG_LEVEL`       | `info`  | Log level: `trace`, `debug`, `info`, `warn`, `error`, `silent` |

## Development

```bash
npm install
npm run build
npm run test
npm run qa
```

### Scripts

| Script              | Description                                   |
| ------------------- | --------------------------------------------- |
| `npm run build`     | Compile TypeScript to `build/`                |
| `npm test`          | Run the unit test suite (Vitest)              |
| `npm run test:unit` | Run the unit tests only (`--project unit`)    |
| `npm run test:e2e`  | Run the e2e tests only (`--project e2e`)      |
| `npm run qa`        | Lint, format, architecture and docs checks    |
| `npm run qa:fix`    | Auto-fix lint and formatting issues           |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`)     |
| `npm run validate`  | Full pipeline: qa → typecheck → build → tests |

## Contributing

Contributions are welcome! Open an [issue](https://github.com/openhoat/aik-mcp/issues) or submit a PR.

See the [changelog](https://github.com/openhoat/aik-mcp/releases) for release history.

Full documentation at **[openhoat.github.io/aik-mcp](https://openhoat.github.io/aik-mcp/)**.

## License

MIT
