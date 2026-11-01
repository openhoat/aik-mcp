import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { parseFrontmatter } from '../../frontmatter.js'
import { buildSkillContent, type EngineItem } from './engine.js'
import { type Agent, getGlobalBaseHint, getLayoutEntry, resolveContentFile } from './factory.js'
import type { Category, LayoutEntry, Scope } from './types.js'

// Version of the plan payload shape. Bumped when an applying agent must change
// how it reads a plan.
export const PLAN_VERSION = 1

const ENTRY_FILE = 'README.md'

export interface PlanFile {
  /** Path relative to the directory the file belongs to. */
  relPath: string
  content: string
  /** `base64` for binary assets, `utf8` for text (the common case). */
  encoding: 'utf8' | 'base64'
  sha256: string
}

// One operation an applying agent performs on its own machine. The plan is a
// declarative operation list: it names no agent-specific directory rule beyond
// the paths it carries, so any agent able to write a file can apply it.
export type PlanAction =
  | { op: 'write_file'; path: string; content: string; sha256: string }
  | { op: 'install_skill'; dir: string; skillMd: PlanFile; assets: PlanFile[] }
  | {
      op: 'section_upsert'
      file: string
      marker: string
      heading: string
      content: string
      sha256: string
    }
  | { op: 'section_remove'; file: string; marker: string }
  | { op: 'delete_file'; path: string }
  | { op: 'delete_dir'; path: string }
  | { op: 'config_entry_add'; key: string; candidates: string[]; path: string }
  | { op: 'config_entry_remove'; key: string; candidates: string[]; path: string }

export interface PlanBase {
  kind: 'project' | 'agent-global'
  /**
   * How to resolve the base directory on the client machine. A plan is computed
   * where the content lives, not where it will be written, so the base is a
   * hint to resolve, never a resolved path.
   */
  hint: string
}

export interface InstallPlan {
  planVersion: number
  operation: 'install' | 'uninstall'
  item: {
    path: string
    name: string
    category: Category
    title: string
    version: string | null
  }
  agent: Agent
  scope: Scope
  base: PlanBase
  actions: PlanAction[]
  warnings: string[]
  summary: string
}

export interface PlanOptions {
  scope: Scope
  /** Version of the item in the knowledge base, informational for `install`. */
  version?: string | null
  /**
   * Config file the client agent already uses, relative to its base directory
   * (absolute or `~` paths are used as is). When absent, the plan falls back on
   * the agent's default config location.
   */
  configPath?: string | null
  warnings?: string[]
}

const sha256 = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex')

// Text assets stay readable in the plan; anything else travels as base64 so the
// applying agent writes the exact bytes back.
const encodeContent = (buffer: Buffer): { content: string; encoding: 'utf8' | 'base64' } => {
  const text = buffer.toString('utf-8')
  return Buffer.from(text, 'utf-8').equals(buffer)
    ? { content: text, encoding: 'utf8' }
    : { content: buffer.toString('base64'), encoding: 'base64' }
}

const collectAssets = (root: string, current: string, acc: PlanFile[]): PlanFile[] => {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const full = join(current, entry.name)
    const relPath = relative(root, full).split(sep).join('/')
    if (entry.isDirectory()) {
      collectAssets(root, full, acc)
      continue
    }
    if (!entry.isFile() || relPath === ENTRY_FILE) continue
    const buffer = readFileSync(full)
    acc.push({ relPath, sha256: sha256(buffer), ...encodeContent(buffer) })
  }
  return acc
}

const planBase = (agent: Agent, scope: Scope): PlanBase =>
  scope === 'global'
    ? { kind: 'agent-global', hint: getGlobalBaseHint(agent) }
    : { kind: 'project', hint: 'the project root (current working directory of the agent)' }

// Path of the item inside its base directory, in posix form.
const itemRelPath = (entry: LayoutEntry, name: string): string =>
  resolveContentFile(entry, '', name).split(sep).join('/')

// Candidate config files, first existing wins (the first one is created when
// none exists). The global layout prefers an existing opencode.json over
// opencode.jsonc, mirroring the direct engine.
const configCandidates = (scope: Scope, configPath?: string | null): string[] => {
  if (configPath) return [configPath]
  return scope === 'global' ? ['opencode.json', 'opencode.jsonc'] : ['.opencode/opencode.jsonc']
}

const configEntryAction = (
  op: 'config_entry_add' | 'config_entry_remove',
  agent: Agent,
  scope: Scope,
  item: EngineItem,
  options: PlanOptions
): PlanAction => {
  const entry = getLayoutEntry(agent, item.category, scope)
  return {
    op,
    key: 'instructions',
    candidates: configCandidates(scope, options.configPath),
    // Relative to the base: the applying agent renders it tilde-absolute for the
    // global scope (the plan cannot name a client home directory) and uses it as
    // is for the project scope (already relative to the project root).
    path: itemRelPath(entry, item.name),
  }
}

const planFileInstall = (
  agent: Agent,
  item: EngineItem,
  entry: LayoutEntry,
  options: PlanOptions
): PlanAction[] => {
  const actions: PlanAction[] = [
    {
      op: 'write_file',
      path: itemRelPath(entry, item.name),
      content: item.rawContent,
      sha256: sha256(item.rawContent),
    },
  ]
  if (entry.configUpdate === 'opencode-instructions') {
    actions.push(configEntryAction('config_entry_add', agent, options.scope, item, options))
  }
  return actions
}

const planSkillInstall = (item: EngineItem, entry: LayoutEntry): PlanAction[] => {
  const targetFile = itemRelPath(entry, item.name)
  const skillDir = dirname(targetFile)
  const skillMd = buildSkillContent(item.rawContent, item.name)
  const assets = item.sourceDir == null ? [] : collectAssets(item.sourceDir, item.sourceDir, [])

  return [
    {
      op: 'install_skill',
      dir: skillDir,
      skillMd: { relPath: 'SKILL.md', content: skillMd, encoding: 'utf8', sha256: sha256(skillMd) },
      assets,
    },
  ]
}

const sectionFile = (entry: LayoutEntry, item: EngineItem, options: PlanOptions): string =>
  options.configPath ?? itemRelPath(entry, item.name)

const planSectionInstall = (
  item: EngineItem,
  entry: LayoutEntry,
  options: PlanOptions
): PlanAction[] => {
  const { body } = parseFrontmatter(item.rawContent)
  const content = body.trimEnd()
  return [
    {
      op: 'section_upsert',
      file: sectionFile(entry, item, options),
      marker: `<source>${item.path}</source>`,
      heading: `## ${item.title}`,
      content,
      sha256: sha256(content),
    },
  ]
}

export const planInstall = (agent: Agent, item: EngineItem, options: PlanOptions): InstallPlan => {
  const entry = getLayoutEntry(agent, item.category, options.scope)

  let actions: PlanAction[]
  switch (entry.format) {
    case 'file':
      actions = planFileInstall(agent, item, entry, options)
      break
    case 'directory-skill':
      actions = planSkillInstall(item, entry)
      break
    case 'section':
      actions = planSectionInstall(item, entry, options)
      break
  }

  return {
    planVersion: PLAN_VERSION,
    operation: 'install',
    item: {
      path: item.path,
      name: item.name,
      category: item.category,
      title: item.title,
      version: options.version ?? null,
    },
    agent,
    scope: options.scope,
    base: planBase(agent, options.scope),
    actions,
    warnings: options.warnings ?? [],
    summary: `install ${item.path} for ${agent} (${options.scope}): ${actions.length} action(s) to apply`,
  }
}

export const planUninstall = (
  agent: Agent,
  item: EngineItem,
  options: PlanOptions
): InstallPlan => {
  const entry = getLayoutEntry(agent, item.category, options.scope)
  const target = itemRelPath(entry, item.name)
  const actions: PlanAction[] = []

  switch (entry.format) {
    case 'file': {
      if (entry.configUpdate === 'opencode-instructions') {
        actions.push(configEntryAction('config_entry_remove', agent, options.scope, item, options))
      }
      actions.push({ op: 'delete_file', path: target })
      break
    }
    case 'directory-skill':
      actions.push({ op: 'delete_dir', path: dirname(target) })
      break
    case 'section':
      actions.push({
        op: 'section_remove',
        file: sectionFile(entry, item, options),
        marker: `<source>${item.path}</source>`,
      })
      break
  }

  return {
    planVersion: PLAN_VERSION,
    operation: 'uninstall',
    item: {
      path: item.path,
      name: item.name,
      category: item.category,
      title: item.title,
      version: options.version ?? null,
    },
    agent,
    scope: options.scope,
    base: planBase(agent, options.scope),
    actions,
    warnings: options.warnings ?? [],
    summary: `uninstall ${item.path} from ${agent} (${options.scope}): ${actions.length} action(s) to apply`,
  }
}
