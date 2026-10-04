# 0001 — One install engine over a declarative layout

- Status: accepted
- Date: 2026-10-04

## Context

Installation behaviour for every agent lived as a `switch` on the install
format inside four separate tools (install, uninstall/list, update). The agent
definitions carried data only — a format tag, a path function and a
config-update tag — so the tools re-implemented the same branching four times.
They drifted: listing reported shared-section items that bulk uninstall silently
skipped, capability was enforced by scattered per-agent checks, and one
unsupported combination threw out of the handler.

## Decision

Introduce a single deep module — the **install engine** — that owns all
installation behaviour, and make each agent describe _where_ its content lives
declaratively:

- A per-scope **layout** maps a category to a **layout entry** (format,
  directory, filename template).
- Support for a category in a scope is the presence of that category in the
  scope's layout. Capability is derived, never declared twice.
- `uninstallAll` is defined as `list` then `uninstall`, so "everything listed is
  removable" holds by construction.
- Each agent carries its own detection patterns and priority; the detection
  module derives the agent list from the registry.

We explicitly rejected a **behavioural port per agent** (one module implementing
install/uninstall/list for each agent). It would replace one `switch` with N
modules and N drift surfaces, and it would not give a single seam to test a new
agent against.

## Consequences

- Adding an agent becomes declaring its layout, detection and config update in
  one place.
- A fix to an install format applies to every tool at once.
- The engine is the seam the contract test matrix exercises over agent ×
  category × supported scope.
- The tools become thin MCP adapters with no format branching.
- A dependency rule forbids root tool modules from touching the filesystem
  directly, so the engine seam cannot silently re-form.
