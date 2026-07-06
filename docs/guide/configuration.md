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
        "LOG_LEVEL": "info"
      }
    }
  }
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

aik-mcp provides knowledge management. Use `aik_list`, `aik_get`, `aik_search`, `aik_install`, and related tools to manage rules, skills, workflows, and templates.
```

> **Tip:** Set `AIK_CONTENT_DIR` to a shared path (Dropbox, git repo, team NAS) to use the same knowledge base across projects and agents.

## CLI options

| Flag         | Default | Description                             |
|--------------|---------|-----------------------------------------|
| `--http`     | —       | Start in HTTP/SSE mode instead of stdio |
| `--port <n>` | `3456`  | HTTP server port (only with `--http`)   |
| `--no-watch` | —       | Disable file watching                   |

## Environment variables

| Variable          | Default | Description                                                    |
|-------------------|---------|----------------------------------------------------------------|
| `AIK_CONTENT_DIR` | `.`     | Path to the content directory                                  |
| `LOG_LEVEL`       | `info`  | Log level: `trace`, `debug`, `info`, `warn`, `error`, `silent` |
