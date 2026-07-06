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
| `author` | No | Creator identifier |
| `created` | No | ISO date |
| `updated` | No | ISO date |

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
| Command | CLI command shortcuts | `commands/` |
| Template | File or project scaffolds | `templates/` |

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
