# Configuration

## Client configuration

### opencode

Add to `opencode.jsonc` or `.opencode/opencode.jsonc` in your project:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "aik": {
      "type": "local",
      "command": ["npx", "-y", "@headwood/aik-mcp"],
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
      "args": ["@headwood/aik-mcp"],
      "env": {
        "AIK_CONTENT_DIR": "/path/to/your/knowledge",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Cline

Add to `cline.json` or `.mcp.json`:

```json
{
  "mcpServers": {
    "aik": {
      "command": "npx",
      "args": ["@headwood/aik-mcp"],
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
"aik" = { command = ["npx", "@headwood/aik-mcp"], env = { AIK_CONTENT_DIR = "/path/to/your/knowledge", LOG_LEVEL = "info" } }
```

### GitHub Copilot

Configure the MCP server in your IDE settings (VS Code, JetBrains, etc.) and add project instructions to `.github/copilot-instructions.md`:

```markdown
## MCP servers

aik-mcp provides knowledge management. Use `aik_list`, `aik_get`, `aik_search`, `aik_install`, and related tools to manage rules, skills, workflows, and agents.
```

> **Tip:** Set `AIK_CONTENT_DIR` to a shared path (Dropbox, git repo, team NAS) to use the same knowledge base across projects and agents.

## HTTP transport

The HTTP transport is **fail closed**: `--http` without a real `MCP_API_KEY`
(empty or `change-me`) makes the server exit. `/health` stays public, every
other route requires `Authorization: Bearer <key>`.

```bash
MCP_API_KEY="$(openssl rand -hex 32)" AIK_CONTENT_DIR=/srv/aik-content aik-mcp --http --port 3456
```

Remote client (opencode):

```jsonc
{
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
