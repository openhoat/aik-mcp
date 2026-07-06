---
title: "How to Create Shareable Knowledge Content"
description: "Guidelines for discovering, consuming, creating, and maintaining
  rules, skills, workflows, agents, commands, and templates via the aik system.
  Ensures content is generic, self-contained, and cross-project shareable."
tags: [aik, meta, shareable-content, workflow]
version: "2.0.0"
compatibility: [opencode, claude-code, cline]
---

## Overview

`aik` is a knowledge system for AI agents. It provides two main flows:

- **Consumption** — discover, read, and install existing knowledge content
  (rules, skills, workflows, agents, commands, templates) into the current
  project.
- **Creation** — write new knowledge content into the shared knowledge base so
  it can be reused across projects and sessions.

The knowledge base lives in `AIK_CONTENT_DIR` (shared, generic, version
controlled). Installing content copies it into the project's agent config
(specific, local).

## Core Concepts

### Content Types

| Type     | Path prefix  | Purpose                                                                                   |
|----------|--------------|-------------------------------------------------------------------------------------------|
| Rule     | `rules/`     | A standard to respect — coding conventions, quality gates, security policies              |
| Skill    | `skills/`    | A reusable instruction block — a prompt, recipe, or procedure the agent invokes on demand |
| Workflow | `workflows/` | A multi-step process — release, deployment, onboarding, review                            |
| Agent    | `agents/`    | A specialized agent configuration — role, tools, output format                            |
| Command  | `commands/`  | A CLI command definition — shortcuts for repetitive tasks                                 |
| Template | `templates/` | A file or project scaffold — starting point for new files                                 |

### Knowledge Base vs Project Config

- `aik_write` writes to the **shared knowledge base** (`AIK_CONTENT_DIR`).
  Content must be generic — no project-specific paths, names, or assumptions.
- `aik_install` copies content from the knowledge base into the **project's
  agent config** (e.g. `.opencode/rules/`, `.claude/commands/`).
- `aik_list_installed` shows what's currently installed in the project.

## Discovery Flow

At the start of a session or when the user mentions a topic, proactively
search the knowledge base for relevant content:

1. Call `aik_search` with keywords related to the project's stack, language,
   or domain (e.g. "typescript", "testing", "git", "security").
2. Review the results — read titles and descriptions to assess relevance.
3. If relevant content exists, suggest installing it with `aik_install`.

Example: user opens a TypeScript project → search "typescript" → find
`rules/typescript` → suggest installing it.

## Consumption Flow

When relevant content is found in the knowledge base:

1. Call `aik_get` to read the full content before suggesting it.
2. Present a brief summary to the user.
3. If the user agrees, call `aik_install(path)` to activate it in the project.
4. After install, the content is loaded automatically in future sessions.

## Creation Flow

When the user asks to create new knowledge — or when you identify a recurring
pattern worth capturing as a rule, skill, or workflow:

1. **Identify the type** — map the request to the correct path prefix (see
   Content Types above).
2. **Ask for key information** — title, description, tags (prompt the user if
   not provided).
3. **Draft the content** — follow the Content Principles and Content
   Structure below.
4. **Create via aik-write** — call `aik_write` with the path, content, title,
   description, and tags.
5. **Offer to install** — suggest `aik_install(path)` so the content is
   activated in the current project immediately.

## Lifecycle Flow

Installed content can evolve over time:

- `aik_check_updates` — detect if newer versions exist in the knowledge base.
- `aik_update` — update a specific installed item to the latest version.
- `aik_reinstall` — uninstall and reinstall (clean refresh).
- `aik_uninstall` — remove an installed item from the project.
- `aik_uninstall_all` — remove all aik-installed items.

Suggest running `aik_check_updates` periodically or when the user reports
issues with installed content.

## Content Principles

- **Generic** — zero references to any specific project (no hardcoded paths,
  project names, repository URLs, or technology assumptions).
- **Self-contained** — all instructions must be understandable without
  external context from a particular project.
- **Multi-agent compatible** — must work with opencode, Claude Code, and
  Cline (use the `compatibility` frontmatter field).
- **Mandatory frontmatter** — every content item MUST include `title`,
  `description`, `tags`, `version`, and `compatibility`.

## Content Structure

A well-formed content file follows this structure:

```markdown
---
title: "Rule Name"
description: "One-line description of what this rule enforces or provides"
tags: [tag1, tag2]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Objective

What this content achieves and why it matters.

## Rules / Steps / Instructions

The actual content — rules to follow, steps to execute, or instructions to
apply.

## Enforcement / Integration

How compliance is verified or how this integrates with other content.
```

### Tagging guidelines

- Use lowercase, kebab-case tags: `typescript`, `error-handling`, `git-flow`.
- Include the domain and the concern: `[typescript, testing]`, `[git,
  workflow]`.
- Tags drive `aik_list` filtering and `aik_search` relevance.

### Versioning

- Use semver: `1.0.0`.
- Bump patch for typos/clarifications, minor for additions, major for
  breaking changes.
- `aik_update` compares versions to detect available updates.

## Examples

### Example 1: Search and install

> **Context**: User opens a TypeScript project.
>
> ```text
> aik_search(query="typescript")
> // → finds rules/typescript, rules/testing
> aik_get(path="rules/typescript")
> // → read full content
> // suggest: "Found a TypeScript conventions rule. Install it?"
> aik_install(path="rules/typescript")
> ```

### Example 2: Create a rule

> **User**: "Create a rule that says all error messages must include a
> correlation ID"
>
> ```text
> aik_write(
>   path="rules/error-correlation-id",
>   content="## Objective\n\nAll error messages MUST include a correlation ID...",
>   title="Error Correlation ID Requirement",
>   description="Mandates a correlation ID in all error messages for traceability",
>   tags=["error-handling", "observability", "logging"]
> )
> ```
>
> Then: "I've created the rule. Would you like me to install it in this
> project with `aik_install("rules/error-correlation-id")`?"

### Example 3: Identify a pattern and suggest creation

> **Context**: You notice the user repeats the same git commit formatting
> corrections across sessions.
>
> ```text
> // Suggest: "I notice you often need to fix commit message formatting.
> // Would you like me to create a rule for that?"
> aik_write(
>   path="rules/commit-messages",
>   content="## Commit Messages\n\nFollow Conventional Commits format...",
>   title="Git Commit Messages",
>   description="Ensures commit messages follow Conventional Commits in English",
>   tags=["git", "conventional-commits", "english"]
> )
> ```

### Example 4: Update installed content

> **Context**: `aik_check_updates` reports a newer version of
> `rules/typescript`.
>
> ```text
> aik_update(path="rules/typescript")
> // → updated to latest version
> ```

## Notes

- Content in the knowledge base (`AIK_CONTENT_DIR`) is shared and generic —
  never write project-specific content there.
- To create project-specific content, write directly in the project's agent
  config directory (e.g. `.opencode/rules/`).
- Be proactive: search for relevant content at the start of a session and
  suggest creation when you identify recurring patterns.
