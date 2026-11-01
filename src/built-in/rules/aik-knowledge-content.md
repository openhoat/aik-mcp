---
title: "How to Create Shareable Knowledge Content"
description:
  "Discover, apply, create and maintain rules, skills, workflows and agents
  with the aik knowledge system: the installation plan contract (applied on your own
  machine, whatever the agent), the local inventory procedure, and the content
  conventions."
tags: [aik, meta, shareable-content, workflow]
version: "4.1.0"
compatibility: [opencode, claude-code, cline]
---

## Overview

`aik` is a knowledge system for AI agents, served over MCP. It has two flows:

- **Consumption** — find content in the knowledge base and install it into your
  own agent configuration.
- **Creation** — write new content into the knowledge base so it can be reused
  across projects and sessions.

The knowledge base is shared and generic. An **installation** is local to a
machine, a user and an agent. Those two things sit on opposite sides of the MCP
boundary, which is why `install` can answer with a **plan** instead of writing
files: the server does not necessarily run on the machine that will hold the
installation.

You never have to guess which case you are in. Read the answer:

- `installed` + `config` — the server wrote it (it runs on your machine).
  Nothing else to do.
- `planVersion` + `actions` — the server planned it (it runs elsewhere).
  **You** apply it with your own file tools.

The plan is agent-agnostic: it is a list of file operations, with the paths and
the agent configuration edits already resolved for the agent and the scope you
asked for. Applying it needs no knowledge of aik's internals, and no knowledge
of any other agent.

## Core Concepts

### Content types

| Type     | Path prefix  | Purpose                                                                                   |
| -------- | ------------ | ----------------------------------------------------------------------------------------- |
| Rule     | `rules/`     | A standard to respect — coding conventions, quality gates, security policies              |
| Skill    | `skills/`    | A reusable instruction block — a prompt, recipe, or procedure the agent invokes on demand |
| Workflow | `workflows/` | A multi-step process — release, deployment, onboarding, review                            |
| Agent    | `agents/`    | A specialized agent configuration — role, tools, output format                            |

### Bundle structure

Each content item is a **bundle**: a directory containing a `README.md` entry
file plus optional supporting assets referenced by the README.

```text
content/
  skills/generate-changelog/
    README.md                 # Entry file — carries the frontmatter
    assets/
      changelog.mjs           # Supporting asset, referenced relatively
```

- The **entry file** is always `README.md`. It holds the frontmatter
  (title, description, tags, version, compatibility).
- **Assets** are any other files in the bundle. `aik_get` lists them via the
  `assets` field; `aik_get_asset(path, asset)` reads one.
- The category is carried by the parent directory — no subdirectories.

### Knowledge base vs installation

- `aik_write` writes to the **shared knowledge base**. Content must be generic —
  no project-specific paths, names, or assumptions.
- An installation materializes content into **one agent's configuration**, in the
  project scope (the workspace you are working in) or the global scope (the user
  configuration of that agent).
- `aik_layout` returns where each agent installs each category: a base directory
  per scope, and a directory, a file template and a materialization format per
  category. Paths are relative, so the answer is valid from any machine.

### Installation formats

Three formats, and the plan is expressed in terms of them:

- **file** — one markdown file per item. Some agents also require the file to be
  referenced from their configuration; the plan carries that edit as a separate
  action.
- **skill** — one directory per item, holding a `SKILL.md` and the bundle assets.
- **section** — several items share one markdown file, each contributing a `##`
  section that carries a `<source>rules/my-rule</source>` marker. The marker is
  how the item is found again and how re-installing stays idempotent.

## Installing content

1. `aik_get(path)` to read the content before suggesting it.
2. `aik_install(path, agent, scope)` — `agent` is the agent you are running as,
   `scope` is `project` unless the user wants a user-wide installation. In remote
   mode, pass `projectInfo` when you know it: `stacks` (detected technology
   stacks) and `mcpServers` (the MCP servers configured in the project, or `null`).
   Without it, gating only warns.
3. If the answer is a **plan**, apply it (below), then report what you wrote.
4. Content installed in the project scope is loaded automatically in future
   sessions of that project.

### Applying a plan

1. **Resolve the base.** `base.kind: project` → the root of the workspace you are
   working in. `base.kind: agent-global` → resolve `base.hint` on your machine
   (`~` is your home directory; a hint like `$CODEX_HOME or ~/.codex` gives a
   primary and a fallback). Every action path is relative to that base, unless it
   is absolute or starts with `~`. Never resolve a path against the directory the
   aik server runs in.
2. **Execute the actions in order** (table below). Create parent directories.
3. **Verify every file you wrote**: its sha256 must equal the action `sha256`.
   For a `base64` asset, decode first, then hash the bytes. On a mismatch, stop,
   re-fetch the plan, and apply it again — never patch the content by hand.
4. **Report** the paths you wrote and the item version, in one or two lines.

| `op`                  | What to do                                                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `write_file`          | Write `content` to the file at `path`, replacing it if it exists.                                                                                                                                                                             |
| `install_skill`       | Create `dir`. If `dir/SKILL.md` already exists, the skill is installed: do nothing. Otherwise write `skillMd` inside it, then each asset at its `relPath` (`base64` → decode to bytes, `utf8` → write the text), creating parent directories. |
| `section_upsert`      | In the markdown file `file`: if a `##` heading already opens on `marker` (first non-blank line after it), do nothing. Otherwise append `\n{heading}\n\n{marker}\n\n{content}\n`.                                                              |
| `section_remove`      | In `file`, remove the `##` heading that opens on `marker` and everything up to the next heading that opens on a `<source>` marker, or to the end of the file. Keep the rest untouched.                                                        |
| `delete_file`         | Delete `path`. A missing file means the work is already done.                                                                                                                                                                                 |
| `delete_dir`          | Delete the directory at `path` and its content. A missing directory means the work is already done.                                                                                                                                           |
| `config_entry_add`    | In the JSON configuration file among `candidates` (the first that exists; create the first if none does), make the string array at `key` contain the entry value. Leave the rest of the file intact.                                          |
| `config_entry_remove` | Same file, same `key`: remove the entry value if present.                                                                                                                                                                                     |

**Section bounds.** A section starts at a `##` heading whose first non-blank
line is the marker. Its end is the next heading that opens on a marker (any
`<source>…</source>` line), or the end of the file. The body of a section is
content, and content carries its own `##` headings (`## Objective`, `## Rules`):
those are not boundaries. Bounding on any heading is how a removal used to cut a
section in half, leaving the rest orphaned in the shared file and the marker
gone. When a file has no marker at all, there is nothing to remove.

**Config entry value.** `path` is the instruction file of the item, relative to
the base. The value to store is:

- `scope: project` → `path` as is (it is already relative to the project root);
- `scope: global` → the absolute path of `<base>/<path>`, written with `~` instead
  of your home directory.

**Idempotence.** Applying the same plan twice changes nothing. Re-applying a plan
is always safe; it is also how you repair a partial application.

### Large payloads: fetch the plan over HTTP

When the plan is big (a skill bundle with assets), do not re-emit its content
through your own message. If the server exposes HTTP, fetch it and apply it in a
script:

```bash
curl -fsS -H "Authorization: Bearer $AIK_API_KEY" \
  "https://<aik-host>/plan/skills/generate-changelog?agent=codex&scope=project" \
  -o /tmp/aik-plan.json
```

The body is exactly the plan JSON the `install` tool returns. The route is
authenticated like `/mcp`; it refuses to run without a bearer token.

### Updating and uninstalling

- **Uninstall**: `aik_uninstall(path, agent, scope)` returns a plan (remote mode)
  whose actions delete the files and config entries; apply it the same way. In
  local mode the server removes them itself.
- **Update**: an item is updated by uninstalling it, then installing it again.
  Check first that the knowledge base carries a newer version (below).
- **No version tracking for sections**: items installed as a section of a shared
  file carry no version. Uninstall then install to refresh them.

## Inventorying an installation

`aik_check_updates` needs to know what you have installed. In remote mode it asks
you for an inventory; in local mode the server reads it from disk. An inventory is
built the same way in both cases:

1. `aik_layout` — read the `base` and, per category, the `dir` and `file` of your
   agent for the scope you care about.
2. List the installed items:
   - **file** format: each `*.md` file in `dir` is an item; its path is
     `<category>/<file name without .md>`.
   - **skill** format: each subdirectory of `dir` that contains a `SKILL.md` is an
     item; its path is `<category>/<directory name>`.
   - **section** format: each `##` section of the shared file whose body contains a
     `<source>path</source>` marker is an item; its path is the marked path.
3. Read the `version` field of the frontmatter of each installed file (`SKILL.md`
   for skills). A section has no version.
4. Send `[{ path, version }]` to `aik_check_updates`. The answer lists the items
   whose knowledge base version is newer, the ones already up to date, and the
   ones the knowledge base does not know.

## Gating: `applies-to` and `requires`

Two optional frontmatter fields let an install refuse a context where the content
would be useless:

- **`applies-to`** — technology stacks the content targets (`angular`, `python`,
  `rust`, …). The install blocks when the project stacks are known and none match.
- **`requires`** — MCP servers the content depends on (`mcp-local-rag`, …). The
  install blocks when the project MCP configuration is known and a required server
  is missing.

Both are evidence-based: with no information, they only warn, never block. A
remote server cannot inspect your project, so it uses the `projectInfo` you pass;
omitting it is safe but weaker. `force: true` bypasses a block when the user has a
documented reason.

## Discovery flow

At the start of a session, or when the user mentions a topic, search the knowledge
base for relevant content:

1. `aik_search` with keywords related to the stack, language or concern
   (`typescript`, `testing`, `git`, `security`).
2. Read titles and descriptions to judge relevance.
3. Propose the match to the user, then install it.

Example: the user opens a TypeScript project → search `typescript` → find
`rules/typescript` → propose it → install it.

## Creation flow

When the user asks for new knowledge, or when you notice a recurring pattern worth
capturing:

1. **Identify the type** — a rule, a skill, a workflow or an agent.
2. **Ask for the missing pieces** — title, description, tags.
3. **Draft** following Content Principles and Content Structure below.
4. **Write** with `aik_write` (path, content, title, description, tags).
5. **Offer to install** it in the current project.

## Content principles

- **Generic** — zero references to a specific project (no hardcoded paths,
  project names, repository URLs, or technology assumptions).
- **Self-contained** — understandable without external context from a particular
  project.
- **Multi-agent compatible** — must work with any MCP-capable agent; declare the
  ones you tested in `compatibility`.
- **Mandatory frontmatter** — `title`, `description`, `tags`, `version`,
  `compatibility`.

## Content structure

```text
{category}/{name}/
  README.md
  assets/…                # optional supporting files
```

The `README.md` entry file:

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

### Assets

Supporting files live in the bundle and are referenced relatively from the README:

```text
skills/generate-changelog/
  README.md
  assets/changelog.mjs
```

- `aik_get(path)` returns the item with its `assets` list.
- `aik_get_asset(path, asset)` reads a single asset.
- An installed skill carries its assets beside `SKILL.md`: the plan embeds them,
  text as is and binary as base64.

### Tagging guidelines

- Lowercase, kebab-case tags: `typescript`, `error-handling`, `git-flow`.
- Include the domain and the concern: `[typescript, testing]`, `[git, workflow]`.
- Tags drive `aik_list` filtering and `aik_search` relevance.

### Versioning

- Semver: `1.0.0`. Patch for fixes, minor for additions, major for breaking
  changes.
- The installed file keeps the frontmatter, including `version`: that is how an
  installation is compared with the knowledge base later.

## Examples

### Example 1: search and install, local server

> **Context**: the user opens a TypeScript project, the aik server runs on this
> machine.
>
> ```text
> aik_search(query="typescript")                    → rules/typescript, rules/testing
> aik_get(path="rules/typescript")                   → read it
> aik_install(path="rules/typescript", agent="opencode", scope="project")
>   → { installed: "rules/typescript", file: "…", config: "…" }
> ```

### Example 2: same install, remote server, file-based agent

> **Context**: same request, the server runs elsewhere, the agent is Claude Code.
>
> ```text
> aik_install(path="rules/typescript", agent="claude-code", scope="project")
>   → { planVersion: 1, base: { kind: "project" }, actions: [
>        { op: "write_file", path: ".claude/rules/typescript.md",
>          content: "---\ntitle: …", sha256: "6f1c…" } ] }
> ```
>
> Write `.claude/rules/typescript.md` in the project, check the sha256, done.

### Example 3: a section, and a configuration entry

> **Context**: the same rule for Codex, whose rules are sections of `AGENTS.md`,
> and for opencode, whose rules must also be listed in its configuration.
>
> ```text
> // Codex, global scope
> { op: "section_upsert", file: "AGENTS.md",
>   marker: "<source>rules/typescript</source>",
>   heading: "## TypeScript Conventions", content…, sha256: "…" }
>
> // opencode, global scope: one more action, same plan
> { op: "config_entry_add", key: "instructions",
>   candidates: ["opencode.json", "opencode.jsonc"],
>   path: "rules/typescript.md" }
>   → store "~/.config/opencode/rules/typescript.md" in the instructions array
> ```
>
> Neither action is special: they are two entries of the same operation list.

### Example 4: create a rule

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
> Then propose installing it.

### Example 5: update an installed item

> **Context**: the inventory of the project lists `rules/typescript` at `1.0.0`.
>
> ```text
> aik_check_updates(items=[{ path: "rules/typescript", version: "1.0.0" }])
>   → updates: [{ path: "rules/typescript", storeVersion: "1.2.0" }]
> aik_uninstall(path="rules/typescript", agent="codex", scope="project")  → plan, apply
> aik_install(path="rules/typescript", agent="codex", scope="project")    → plan, apply
> ```

## Notes

- Content in the knowledge base is shared and generic — never write
  project-specific content there.
- For project-specific instructions, write directly in the project's agent
  configuration directory instead of creating a knowledge item.
- Be proactive: search at the start of a session, and propose capturing a pattern
  when you notice it repeating.
