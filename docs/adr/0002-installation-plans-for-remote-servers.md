# 0002 — Installation plans for remote servers

- Status: accepted
- Date: 2026-11-01

## Context

The HTTP transport lets one server serve the knowledge base to several machines.
The installation tools kept working as they did over stdio: they resolved the
target from the **server** process — `process.cwd()` for the project scope,
`homedir()` for the global scope — and wrote there.

When the server runs in a container on another host, that is a category error.
The write lands in the container (`/app`, `/home/node`), or fails on a read-only
path, and the tool reports success anyway: nothing distinguishes "installed on
the client's machine" from "installed inside the server". The same mistake
breaks detection-backed gating, which probed the wrong project.

An MCP server executes its tools where it runs. No protocol feature (roots,
sampling, elicitation) lets a tool reach the client's filesystem. So the write
must happen client-side; the only question is what form that client-side
component takes.

## Decision

Over HTTP, the installation family becomes **planners**:

- `install` and `uninstall` return a **plan**: an ordered list of operations
  (`write_file`, `install_skill`, `section_upsert`, `section_remove`,
  `delete_file`, `delete_dir`, `config_entry_add`, `config_entry_remove`), with
  content, skill assets and a sha256 per file. Paths are relative to a base the
  plan names declaratively (`base.kind` + `base.hint`, e.g. `~/.claude`,
  `$CODEX_HOME or ~/.codex`), never an absolute path of the server.
- `check_updates` takes the client's inventory (paths and versions) and answers
  against the knowledge base.
- `aik_layout` publishes the agent × scope × category tables as data, so a client
  can build that inventory without reading any server state.
- `reinstall`, `update`, `list_installed` and `uninstall_all` are dropped in HTTP
  mode: they are compositions of the three above, documented as procedures.
- A new authenticated route, `GET /plan/<item>?agent=&scope=`, serves the same
  plan to shell clients, so large content never has to be re-emitted through a
  model.

Over stdio nothing changes: the server runs on the target machine and keeps
writing directly. `aik_layout` is registered in both modes.

Gating in plan mode is evaluated on facts the client reports (`projectInfo`:
`stacks`, `mcpServers`). Absent information only warns, never blocks — the
server-side probe is disabled rather than run against the wrong machine.

We rejected two alternatives:

- **Client-side agent tooling** (one custom tool per client) — deterministic, but
  ties the installation family to a single agent, and the point of aik is to be
  agent-agnostic.
- **A second local MCP server or a local proxy** — same determinism, two MCP
  blocks to install and maintain, plus a network dependency on every call.

## Consequences

- The installation family is honest in both modes: it never claims a write it did
  not perform.
- Applying a plan is the client's job, so the quality of the bundled instructions
  is now load-bearing. Two guardrails: a sha256 per file, and `GET /plan` for
  scripted application.
- Agent specifics stay in the planner tables; the contract vocabulary
  (`write_file`, `section_upsert`, …) names no agent. A parity test applies each
  plan through a third-party applier and compares the result with the direct
  engine, over the whole matrix (agent × scope × category × format), so an
  accidental assumption fails the matrix instead of a single case.
- `install_skill` skips an existing skill directory, mirroring the direct engine:
  updating means uninstalling first, in both modes.
- The tool list now depends on the transport (14 over stdio, 10 over HTTP). A
  client caches tool schemas, so it must be reconnected after a deployment.
