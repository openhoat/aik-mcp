# Content Authoring

This guide explains how to write high-quality content for the aik knowledge base.

## Frontmatter

Every content file must have YAML frontmatter with these fields:

```yaml
---
title: "My Rule"
description: "What this rule enforces or provides"
tags: [typescript, conventions]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Human-readable name |
| `description` | Yes | One-line summary |
| `tags` | Yes | Lowercase kebab-case tags |
| `version` | No | Semver for update tracking |
| `compatibility` | No | Target agents (defaults to all) |
| `applies-to` | No | Technology stacks this content targets (install gating) |
| `requires` | No | MCP servers this content depends on (install gating) |
| `author` | No | Creator identifier |
| `created` | No | ISO date |
| `updated` | No | ISO date |

### Gating

`applies-to` and `requires` make `install` refuse irrelevant installations:

- `applies-to: [angular]` — blocked in a project whose detected stack does not
  include `angular` (detection is based on marker files such as `angular.json`,
  `pyproject.toml`, `Cargo.toml`, `package.json`).
- `requires: [mcp-local-rag]` — blocked when the project's MCP configuration is
  found and does not declare that server.

Gating is evidence-based: when the project stack or MCP configuration cannot be
determined, `install` emits a warning instead of blocking. Use `force: true` to
bypass a block.

## Principles

- **Generic** — no project-specific paths, names, or assumptions
- **Self-contained** — understandable without external context
- **Multi-agent** — works with opencode, Claude Code, and Cline

## Content types

| Type | Purpose | Path prefix |
|------|---------|-------------|
| Rule | Coding standards, quality gates, security policies | `rules/` |
| Skill | Reusable prompts, recipes, procedures | `skills/` |
| Workflow | Multi-step processes (release, deployment) | `workflows/` |
| Agent | Specialized agent configurations | `agents/` |

## Bundle structure

Each content item is a directory (bundle) with a `README.md` entry file plus
optional supporting assets:

```text
skills/generate-changelog/
  README.md                 # entry file — carries the frontmatter
  assets/changelog.mjs      # supporting asset, referenced relatively
```

- The entry file is always `README.md` and holds the frontmatter.
- Assets are listed by `aik_get` and read via `aik_get_asset`.
- When a skill is installed, its assets are copied alongside `SKILL.md`.

## Best practices

- Start with a clear **Objective** section
- Use **concrete examples** over abstract descriptions
- Keep files focused — one concept per file
- Use `version` for content that evolves over time
- Tag with domain and concern: `[typescript, testing]`

## Validation

Use the built-in validation to check your content:

```bash
npx aik-mcp --validate
```

Or use the `aik_validate` tool from your AI agent.
