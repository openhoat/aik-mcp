# Glossary

The vocabulary used by the agent installation code. Prefer these words in code,
issues and tests.

## Agent

A target AI coding tool whose configuration aik-mcp can write: opencode, Claude
Code, Cline, Codex or GitHub Copilot. Registered once in the agent registry.

## Scope

Where content is installed: `project` (the target directory) or `global` (the
agent's user-level directory). Not every agent supports every category in every
scope.

## Category

The kind of knowledge content: `rules`, `skills`, `workflows` or `agents`.

## Format

How one category is materialised on disk:

- **plain file** — one markdown file per item.
- **directory-skill** — one directory per item, containing a `SKILL.md` and any
  bundled assets.
- **shared section** — one section appended to a markdown file shared by several
  items.

## Layout

The declarative map, per scope, from category to layout entry. A category absent
from a scope's layout is **unsupported** in that scope — capability is derived
from the layout, never declared separately.

## Layout entry

One entry of a layout: the **format**, the **directory** (relative to the scope
base directory) and the **filename template** (`{name}` is interpolated per
item; a literal names a shared file).

## Install engine

The single deep module that interprets a layout for install, uninstall, list,
version-read and bulk uninstall. Every tool is a thin adapter over it.

## Content item

A unit of knowledge in the content store, addressed by `<category>/<name>`
(for example `rules/typescript`).

## Bundle

A content item's directory in the store, holding its `README.md` entry file and
optional assets that travel with it on install.
