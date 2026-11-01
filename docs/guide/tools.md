# MCP Tools

aik-mcp exposes the same knowledge base tools in every transport. The
installation tools differ, because an installation is local to the machine that
holds it: over stdio the server runs there and writes the files, over HTTP it
runs elsewhere and returns a plan the client applies.

## Knowledge base tools

Identical in both transports.

| Tool            | Description                                                 |
| --------------- | ----------------------------------------------------------- |
| `aik_list`      | List content items, optionally filtered by category or tag  |
| `aik_get`       | Retrieve a specific item by path (e.g. `rules/typescript`)  |
| `aik_get_asset` | Read a supporting asset bundled with an item                |
| `aik_search`    | Full-text fuzzy search across all content                   |
| `aik_write`     | Create or update a content item from the agent              |
| `aik_delete`    | Delete a content item                                       |
| `aik_layout`    | Where each agent installs each category (base, dir, format) |

`aik_layout` returns, for every supported agent and both scopes, the base
directory (as a hint to resolve locally, like `~/.claude` or `$CODEX_HOME or
~/.codex`) and, per category, the directory, the file template, the
materialization format and whether a config update is needed. Paths are relative,
so the answer is valid from any machine.

## Installation tools

| Tool                 | stdio (local)                | HTTP (remote)                             |
| -------------------- | ---------------------------- | ----------------------------------------- |
| `aik_install`        | installs the item            | returns the installation plan             |
| `aik_uninstall`      | removes the item             | returns the uninstallation plan           |
| `aik_check_updates`  | reads the installed versions | compares an inventory the client sends    |
| `aik_reinstall`      | uninstall then install       | — (apply an uninstall plan, then install) |
| `aik_update`         | updates an installed item    | —                                         |
| `aik_list_installed` | lists installed items        | — (build the inventory from `aik_layout`) |
| `aik_uninstall_all`  | removes every installed item | —                                         |

Over HTTP, 10 tools are registered: the 7 knowledge base tools plus `install`,
`uninstall` and `check_updates`. Over stdio, 14: the same 7 plus the 7
installation tools above.

## Plan mode (HTTP)

`install` and `uninstall` never touch the filesystem in HTTP mode. They return a
plan:

```jsonc
{
  "planVersion": 1,
  "operation": "install",
  "item": {
    "path": "rules/typescript",
    "name": "typescript",
    "category": "rules",
    "title": "TypeScript Conventions",
    "version": "1.2.0",
  },
  "agent": "opencode",
  "scope": "global",
  "base": { "kind": "agent-global", "hint": "~/.config/opencode" },
  "actions": [
    {
      "op": "write_file",
      "path": "rules/typescript.md",
      "content": "---…",
      "sha256": "6f1c…",
    },
    {
      "op": "config_entry_add",
      "key": "instructions",
      "candidates": ["opencode.json", "opencode.jsonc"],
      "path": "rules/typescript.md",
    },
  ],
  "warnings": [],
  "summary": "install rules/typescript for opencode (global): 2 action(s) to apply",
}
```

The applying agent resolves `base` on its own machine, runs the actions, checks
each sha256, and reports. The operations are generic: `write_file`,
`install_skill`, `section_upsert`, `section_remove`, `delete_file`, `delete_dir`,
`config_entry_add`, `config_entry_remove`. No agent table, no knowledge of aik
internals is needed to apply one, which is what keeps the server agent-agnostic.

The same payload is available over HTTP, for shell clients and payloads too large
to pass through a model:

```bash
curl -fsS -H "Authorization: Bearer $MCP_API_KEY" \
  "https://aik-mcp.example.com/plan/rules/typescript?agent=opencode&scope=global"
```

`GET /plan/<item>` accepts `agent` (default `opencode`), `scope` (default
`project`) and `configPath` (default: the agent's usual config file). It is
authenticated like `/mcp`.

The package ships an applier for that payload, so a script does not have to
reimplement the contract:

```bash
aik-apply plan.json --base /path/to/project
aik-apply plan.json --dry-run   # resolve the base and verify, write nothing
```

`aik-apply` reads a plan from a file or stdin, checks every sha256 before
writing, and exits non-zero on a corrupt payload or an unknown operation. Applying
a plan by hand, in an agent session, stays valid: both paths go through the same
payload.

### Why the split

An MCP server executes its tools where it runs. With the server on another
machine, a tool that resolves `process.cwd()` or `homedir()` describes _that_
machine: the install lands in the server container, and the call reports success
anyway. Planning is the only honest answer — the write has to happen where the
agent is.

## Resources

| URI                  | Description                                       |
| -------------------- | ------------------------------------------------- |
| `aik://{category}`   | List all items in a category (e.g. `aik://rules`) |
| `aik://search?q=...` | Search items by keyword                           |

## How it works

```mermaid
graph LR
    Agent[AI Agent<br>opencode / Claude Code / Cline / Codex / Copilot] -->|MCP JSON-RPC| Server(aik-mcp)
    Server --> Store[Content Store<br>in memory]
    Store --> Files[Markdown files<br>rules/ skills/ workflows/ ...]
    Server --> Watcher[File Watcher<br>live sync on change]
    Server --> Tools[MCP Tools<br>list, get, search, write,<br>install (plan), layout]
    Tools -->|plan| Agent
```

Your agent speaks MCP on one side. aik-mcp speaks the knowledge base on the
other, and the agent itself writes the installation on its own machine.
Everything is cached in memory for fast lookups, and a file watcher keeps the
cache up to date.
