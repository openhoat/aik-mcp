# Agent Documentation RAG

Scraped agent documentation for local RAG indexing. The scraper fetches pages from the official documentation sites of opencode, Claude Code, and Cline, converts them to Markdown, and stores them in `rag/agents/`.

## Usage

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

## Pages by Agent

| Agent       | Pages                                                                                                         |
|-------------|---------------------------------------------------------------------------------------------------------------|
| opencode    | intro, overview, rules, skills, agents, commands, config, mcp-servers, permissions, tools                     |
| claude-code | overview, memory, skills, hooks, sub-agents, settings, mcp, permissions, best-practices, common-workflows     |
| cline       | overview, rules, skills, plugins, config, using-commands, subagents, mcp-overview, memory-bank, cli-reference |

## Output Structure

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
    └── cline/
        ├── overview.md
        ├── rules.md
        └── ...
```

Each file includes frontmatter with the original source URL and scrape timestamp, making it easy to refresh individual pages when docs change.

## Regeneration

The `rag/` directory is gitignored. Regenerate at any time:

```bash
npm run scrape:agent-docs
```
