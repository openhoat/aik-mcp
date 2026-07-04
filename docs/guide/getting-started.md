# Getting Started

## Installation

```bash
npx @headwood/aik-mcp
```

Or install globally:

```bash
npm install -g @headwood/aik-mcp
```

## Quick start

### 1. Create a content directory

```bash
mkdir -p my-knowledge/rules
```

### 2. Add a rule

```bash
cat > my-knowledge/rules/typescript.md << 'EOF'
---
title: TypeScript Conventions
description: Coding standards for TypeScript projects
tags: [typescript, conventions]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## TypeScript Conventions

- Use explicit types for public API surfaces
- Prefer `interface` over `type` for object shapes
- Use `const` assertions for literal values
EOF
```

### 3. Start the server

```bash
AIK_CONTENT_DIR=./my-knowledge npx @headwood/aik-mcp
```

### 4. Ask your agent

> "Find and apply the TypeScript conventions rule for this project."

Your agent calls `aik_search`, reads the rule, and applies it — all transparently through MCP.

## Content structure

Content items are organized by category:

| Directory | Purpose |
| --- | --- |
| `rules/` | Coding standards, conventions, quality gates |
| `skills/` | Reusable instruction blocks (prompts, recipes) |
| `workflows/` | Multi-step process definitions |
| `agents/` | Specialized agent configurations |
| `commands/` | Custom CLI command definitions |
| `templates/` | File and project scaffolding |

Each file is plain Markdown with YAML frontmatter:

```markdown
---
title: "My Rule"
description: "What this rule enforces"
tags: [tag1, tag2]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## My Rule

Content here...
```
