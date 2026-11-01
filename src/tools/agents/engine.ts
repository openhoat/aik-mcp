import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parse as parseJsonc, stringify as stringifyJsonc } from 'comment-json'
import { parseFrontmatter, serializeFrontmatterRaw } from '../../frontmatter.js'
import {
  type Agent,
  getLayoutEntry,
  getSupportedCategories,
  resolveContentFile,
} from './factory.js'
import {
  globalOpencodeConfigPath,
  type OpenCodeConfig,
  opencodeInstructionsEntry,
} from './opencode-config.js'
import type { Category, LayoutEntry, Scope } from './types.js'
import { CATEGORIES } from './types.js'

const ENTRY_FILE = 'README.md'

// One item to install, uninstall or version-read.
export interface EngineItem {
  path: string
  category: Category
  name: string
  title: string
  rawContent: string
  sourceDir?: string | null
}

// Where an operation applies: a scope, its base directory and the optional config path.
export interface EngineContext {
  scope: Scope
  baseDir: string
  configPath?: string | null
}

// One installed item as reported by the engine.
export interface InstalledItem {
  path: string
  title: string | null
  category: Category
}

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export const buildSkillContent = (rawContent: string, name: string): string => {
  const { raw, body } = parseFrontmatter(rawContent)
  const skillFrontmatter = { ...raw }
  skillFrontmatter.name = name
  const fm = serializeFrontmatterRaw(skillFrontmatter)
  return `---\n${fm}\n---\n\n${body}`
}

const copyBundleAssets = (sourceDir: string, targetDir: string): void => {
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === ENTRY_FILE) continue
    cpSync(resolve(sourceDir, entry.name), resolve(targetDir, entry.name), { recursive: true })
  }
}

// The opencode config file to update for the opencode-instructions strategy.
const opencodeConfigPath = (context: EngineContext): string =>
  context.scope === 'global'
    ? globalOpencodeConfigPath(context.baseDir)
    : (context.configPath ?? resolve(context.baseDir, '.opencode', 'opencode.jsonc'))

const updateOpencodeInstructions = (configPath: string, entry: string): boolean => {
  let config: OpenCodeConfig
  if (existsSync(configPath)) {
    config = parseJsonc(readFileSync(configPath, 'utf-8')) as OpenCodeConfig // Safe: user-edited config
  } else {
    config = {}
  }

  const instructions = config.instructions ?? []
  if (instructions.includes(entry)) return false

  instructions.push(entry)
  config.instructions = instructions
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${stringifyJsonc(config, null, 2)}\n`, 'utf-8')
  return true
}

const removeFromOpencodeInstructions = (configPath: string, entry: string): boolean => {
  if (!existsSync(configPath)) return false
  const config = parseJsonc(readFileSync(configPath, 'utf-8')) as OpenCodeConfig // Safe: user-edited config
  const instructions = (config.instructions ?? []).filter(e => e !== entry)

  if (instructions.length === (config.instructions ?? []).length) return false

  config.instructions = instructions
  writeFileSync(configPath, `${stringifyJsonc(config, null, 2)}\n`, 'utf-8')
  return true
}

export const removeSections = (
  content: string,
  isTarget: (text: string) => boolean
): { result: string; count: number } => {
  const lines = content.split('\n')
  const kept: string[] = []
  let count = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ') && isTarget(lines.slice(i).join('\n'))) {
      count++
      i++
      while (i < lines.length && !lines[i].startsWith('## ')) {
        i++
      }
      continue
    }

    kept.push(line)
    i++
  }

  return { result: kept.join('\n'), count }
}

// The marker line that identifies an item inside a shared file.
export const sectionMarker = (itemPath: string): string => `<source>${itemPath}</source>`

const isMarkerLine = (line: string | null): boolean => {
  return line !== null && /^<source>[^\s]+<\/source>$/.test(line)
}

// First non-blank line after a heading, i.e. what the section opens with.
const openingLine = (lines: string[], heading: number): string | null => {
  for (let i = heading + 1; i < lines.length; i++) {
    if (lines[i].trim() !== '') return lines[i].trim()
  }
  return null
}

export interface SectionRange {
  start: number
  end: number
}

/**
 * Locate the section carrying `marker`, as a line range (end exclusive).
 *
 * A section is a `##` heading whose first non-blank line is the marker. Its end
 * is the next heading that opens on a marker: the body of a section is content,
 * and content is allowed to carry its own `##` headings, so a bare heading is
 * not a boundary. Bounding on headings alone used to cut a removal at the first
 * `## Objective` inside the body, leaving the rest of the text orphaned in the
 * shared file (and the marker gone, so nothing could find it again).
 */
export const findSection = (content: string, marker: string): SectionRange | null => {
  const lines = content.split('\n')
  const start = lines.findIndex(
    (line, index) => line.startsWith('## ') && openingLine(lines, index) === marker
  )
  if (start < 0) return null

  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ') && isMarkerLine(openingLine(lines, i))) {
      end = i
      break
    }
  }

  return { start, end }
}

export const removeSection = (
  content: string,
  marker: string
): { result: string; count: number } => {
  const range = findSection(content, marker)
  if (!range) {
    // Legacy fallback: a marker that is not the opening line of its heading means
    // the file was not written by this engine. Do what the previous version did
    // rather than refuse, but never worse.
    if (!content.includes(marker)) return { result: content, count: 0 }
    return removeSections(content, text => text.includes(marker))
  }

  const lines = content.split('\n')
  const kept = [...lines.slice(0, range.start), ...lines.slice(range.end)]
  return { result: kept.join('\n'), count: 1 }
}

const installFile = (
  entry: LayoutEntry,
  item: EngineItem,
  context: EngineContext,
  targetFile: string
): { path: string; alreadyInstalled: boolean } => {
  mkdirSync(dirname(targetFile), { recursive: true })
  // Keep the aik frontmatter in the installed file: readVersion reads the
  // `version` field from it to decide whether an update is available. Stripping
  // it made every installed rule/workflow fall back to the default version and
  // be reported as perpetually updatable (check_updates never converged).
  writeFileSync(targetFile, item.rawContent, 'utf-8')

  if (entry.configUpdate !== 'opencode-instructions') {
    return { path: targetFile, alreadyInstalled: false }
  }

  const configPath = opencodeConfigPath(context)
  const entryValue = opencodeInstructionsEntry(context.scope, targetFile, item.category, item.name)
  const wasAdded = updateOpencodeInstructions(configPath, entryValue)
  return { path: configPath, alreadyInstalled: !wasAdded }
}

const installSkill = (
  item: EngineItem,
  targetFile: string
): { path: string; alreadyInstalled: boolean } => {
  if (existsSync(targetFile)) {
    return { path: targetFile, alreadyInstalled: true }
  }

  const skillDir = dirname(targetFile)
  mkdirSync(skillDir, { recursive: true })
  if (item.sourceDir && existsSync(item.sourceDir)) {
    copyBundleAssets(item.sourceDir, skillDir)
  }
  writeFileSync(targetFile, buildSkillContent(item.rawContent, item.name), 'utf-8')
  return { path: targetFile, alreadyInstalled: false }
}

const installSection = (
  item: EngineItem,
  context: EngineContext,
  targetFile: string
): { path: string; alreadyInstalled: boolean } => {
  const mdPath = context.configPath ?? targetFile
  const sourceTag = sectionMarker(item.path)

  const { body } = parseFrontmatter(item.rawContent)
  const section = `\n## ${item.title}\n\n${sourceTag}\n\n${body.trimEnd()}\n`

  // Presence is decided on the marker alone, never on the section bounds: a file
  // hand-edited around an aik section must not receive the item twice.
  if (existsSync(mdPath) && readFileSync(mdPath, 'utf-8').includes(sourceTag)) {
    return { path: mdPath, alreadyInstalled: true }
  }

  // Shared-section files live in a directory that may not exist yet (a fresh
  // project with no .github/ or AGENTS.md); create it before appending.
  mkdirSync(dirname(mdPath), { recursive: true })
  appendFileSync(mdPath, section, 'utf-8')
  return { path: mdPath, alreadyInstalled: false }
}

export const install = (
  agent: Agent,
  item: EngineItem,
  context: EngineContext
): { path: string; alreadyInstalled: boolean } => {
  const entry = getLayoutEntry(agent, item.category, context.scope)
  const targetFile = resolveContentFile(entry, context.baseDir, item.name)

  switch (entry.format) {
    case 'file':
      return installFile(entry, item, context, targetFile)
    case 'directory-skill':
      return installSkill(item, targetFile)
    case 'section':
      return installSection(item, context, targetFile)
  }
}

const uninstallFile = (
  entry: LayoutEntry,
  item: EngineItem,
  context: EngineContext,
  targetFile: string
): boolean => {
  let removed = false

  if (entry.configUpdate === 'opencode-instructions') {
    const entryValue = opencodeInstructionsEntry(
      context.scope,
      targetFile,
      item.category,
      item.name
    )
    removed = removeFromOpencodeInstructions(opencodeConfigPath(context), entryValue)
  }

  if (existsSync(targetFile)) {
    unlinkSync(targetFile)
    removed = true
  }
  return removed
}

const uninstallSkill = (targetFile: string): boolean => {
  const skillDir = dirname(targetFile)
  if (!existsSync(skillDir)) return false
  rmSync(skillDir, { recursive: true, force: true })
  return true
}

const uninstallSection = (
  item: EngineItem,
  context: EngineContext,
  targetFile: string
): boolean => {
  const mdPath = context.configPath ?? targetFile
  if (!existsSync(mdPath)) return false

  const content = readFileSync(mdPath, 'utf-8')
  const { result, count } = removeSection(content, sectionMarker(item.path))
  if (count === 0) return false
  writeFileSync(mdPath, result, 'utf-8')
  return true
}

export const uninstall = (agent: Agent, item: EngineItem, context: EngineContext): boolean => {
  const entry = getLayoutEntry(agent, item.category, context.scope)
  const targetFile = resolveContentFile(entry, context.baseDir, item.name)

  switch (entry.format) {
    case 'file':
      return uninstallFile(entry, item, context, targetFile)
    case 'directory-skill':
      return uninstallSkill(targetFile)
    case 'section':
      return uninstallSection(item, context, targetFile)
  }
}

const listFromFileDir = (baseDir: string, category: Category): InstalledItem[] => {
  if (!isDirectory(baseDir)) return []
  const results: InstalledItem[] = []

  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const name = entry.name.replace(/\.md$/, '')
    results.push({ path: `${category}/${name}`, title: null, category })
  }
  return results
}

const readSkillTitle = (skillFile: string): string | null => {
  try {
    const { raw } = parseFrontmatter(readFileSync(skillFile, 'utf-8'))
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const description = typeof raw.description === 'string' ? raw.description.trim() : ''
    return name || description || null
  } catch {
    // ignore read errors
    return null
  }
}

const listFromSkillDir = (baseDir: string, category: Category): InstalledItem[] => {
  if (!isDirectory(baseDir)) return []
  const results: InstalledItem[] = []

  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillFile = resolve(baseDir, entry.name, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    results.push({ path: `${category}/${entry.name}`, title: readSkillTitle(skillFile), category })
  }
  return results
}

const listFromSections = (mdPath: string, category: Category): InstalledItem[] => {
  if (!existsSync(mdPath)) return []
  const lines = readFileSync(mdPath, 'utf-8').split('\n')
  const results: InstalledItem[] = []

  // A listed item is a heading that opens on a marker. Scanning headings and
  // markers independently (a lazy regex from any heading to the next marker)
  // mis-pairs them as soon as a body carries its own `##` headings.
  lines.forEach((line, index) => {
    if (!line.startsWith('## ')) return
    const opening = openingLine(lines, index)
    if (!isMarkerLine(opening)) return

    const sourcePath = (opening as string).slice('<source>'.length, -'</source>'.length)
    const [rawCategory] = sourcePath.split('/')
    // Safe: a section source path starts with a known category name.
    const itemCategory = (CATEGORIES as string[]).includes(rawCategory)
      ? (rawCategory as Category)
      : category
    results.push({
      path: sourcePath,
      title: line.slice('## '.length).trim(),
      category: itemCategory,
    })
  })

  return results
}

export const list = (agent: Agent, context: EngineContext): InstalledItem[] => {
  // Several categories can share one file (e.g. codex maps rules and workflows to
  // AGENTS.md); scanning per category would report the same item twice. Dedupe by path.
  const byPath = new Map<string, InstalledItem>()

  for (const category of getSupportedCategories(agent, context.scope)) {
    const entry = getLayoutEntry(agent, category, context.scope)
    const targetFile = resolveContentFile(entry, context.baseDir, 'placeholder')
    let found: InstalledItem[] = []

    switch (entry.format) {
      case 'file':
        found = listFromFileDir(dirname(targetFile), category)
        break
      case 'directory-skill':
        found = listFromSkillDir(dirname(dirname(targetFile)), category)
        break
      case 'section':
        found = listFromSections(context.configPath ?? targetFile, category)
        break
    }

    for (const item of found) byPath.set(item.path, item)
  }

  return [...byPath.values()]
}

export const readVersion = (
  agent: Agent,
  item: EngineItem,
  context: EngineContext
): string | null => {
  const entry = getLayoutEntry(agent, item.category, context.scope)
  // The shared-section format is not updatable and carries no version.
  if (entry.format === 'section') return null

  const targetFile = resolveContentFile(entry, context.baseDir, item.name)
  if (!existsSync(targetFile)) return null
  try {
    return parseFrontmatter(readFileSync(targetFile, 'utf-8')).frontmatter.version || null
  } catch {
    return null
  }
}

export const uninstallAll = (agent: Agent, context: EngineContext): number => {
  let count = 0

  for (const item of list(agent, context)) {
    const name = item.path.slice(item.category.length + 1)
    const removed = uninstall(
      agent,
      {
        path: item.path,
        category: item.category,
        name,
        title: item.title ?? '',
        rawContent: '',
      },
      context
    )
    if (removed) count++
  }

  return count
}
