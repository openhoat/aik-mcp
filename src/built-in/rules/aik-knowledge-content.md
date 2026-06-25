---
title: "How to Create Shareable Knowledge Content"
description: "Guidelines for creating new rules, skills, workflows, agents, commands,
and templates via aik-write. Ensures content is generic, self-contained, and
cross-project shareable."
tags: [aik, meta, shareable-content, workflow]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## How to Create Shareable Knowledge Content

### When to Use This

When the user asks to create a new piece of knowledge — a rule, skill, workflow,
agent, command, or template — that should be shared across projects via the `aik`
knowledge system.

### Content Principles

- **Generic** — zero references to any specific project (no hardcoded paths,
  project names, repository URLs, or technology assumptions).
- **Self-contained** — all instructions must be understandable without external
  context from a particular project.
- **Multi-agent compatible** — must work with opencode, Claude Code, and Cline
  (use the `compatibility` frontmatter field).
- **Mandatory frontmatter** — every content item MUST include `title`,
  `description`, `tags`, `version`, and `compatibility`.

### Type-to-Path Mapping

| User says | Path prefix | Example |
| ----------- | ----------- | --------- |
| "rule" | `rules/` | `rules/error-correlation-id` |
| "skill" | `skills/` | `skills/database-migration` |
| "workflow" | `workflows/` | `workflows/release-process` |
| "agent" | `agents/` | `agents/code-reviewer` |
| "command" | `commands/` | `commands/lint-fix` |
| "template" | `templates/` | `templates/react-component` |

### Workflow

1. **Identify the type** — determine what the user wants to create and map it
   to the correct path prefix.
2. **Ask for key information** — title, description, tags (prompt the user if
   not provided).
3. **Draft the content** — write the markdown body following the principles above.
4. **Create via aik-write** — call `aik_aik_write` with the path, content,
   title, description, and tags.
5. **Offer to install** — suggest `aik_aik_install(<path>)` so the content is
   activated in the current project immediately.

### Example

> **User**: "Create a rule that says all error messages must include a
> correlation ID"
>
> **AI reasoning**: type = rule → prefix `rules/` → path `rules/error-correlation-id`
>
> ```text
> aik_aik_write(
>   path="rules/error-correlation-id",
>   content="## Error Correlation ID\n\nAll error messages MUST include a correlation ID...",
>   title="Error Correlation ID Requirement",
>   description="Mandates a correlation ID in all error messages for traceability",
>   tags=["error-handling", "observability", "logging"]
> )
> ```
>
> Then: "I've created the rule. Would you like me to install it in this project
> with `aik_aik_install("rules/error-correlation-id")`?"

### Notes

- If the user wants to share content broadly (not project-specific), they should
  be in the knowledge repository (the `AIK_CONTENT_DIR`) — this is the default
  behavior of `aik_aik_write`.
- If the user wants to create content specific to a single project, use
  `aik_aik_install` after writing, or create the file directly in the project's
  `.opencode/rules/` directory.
