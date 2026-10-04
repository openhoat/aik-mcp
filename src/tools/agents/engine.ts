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
import { getLayoutEntry, getSupportedCategories, resolveContentFile } from './factory.js'
import {
  globalOpencodeConfigPath,
  type OpenCodeConfig,
  opencodeInstructionsEntry,
} from './opencode-config.js'
import type { Agent, Category, Scope } from './types.js'
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

const buildSkillContent = (rawContent: string, name: string): string => {
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
    config = parseJsonc(readFileSync(configPath, 'utf-8')) as OpenCodeConfig
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
  const config = parseJsonc(readFileSync(configPath, 'utf-8')) as OpenCodeConfig
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

    if (/^<!-- from /.test(line) && isTarget(line)) {
      count++
      i++
      while (i < lines.length && !lines[i].startsWith('## ') && !/^<!-- from /.test(lines[i])) {
        i++
      }
      continue
    }

    kept.push(line)
    i++
  }

  return { result: kept.join('\n'), count }
}

export const install = (
  agent: Agent,
  item: EngineItem,
  context: EngineContext
): { path: string; alreadyInstalled: boolean } => {
  const entry = getLayoutEntry(agent, item.category, context.scope)
  const targetFile = resolveContentFile(entry, context.baseDir, item.name)

  switch (entry.format) {
    case 'file': {
      mkdirSync(dirname(targetFile), { recursive: true })
      // Instructions files (opencode rules/workflows) are plain markdown: drop the
      // aik frontmatter. Agents keep it — opencode reads it as agent metadata.
      const fileContent =
        entry.configUpdate === 'opencode-instructions'
          ? parseFrontmatter(item.rawContent).body
          : item.rawContent
      writeFileSync(targetFile, fileContent, 'utf-8')

      if (entry.configUpdate === 'opencode-instructions') {
        const configPath = opencodeConfigPath(context)
        const entryValue = opencodeInstructionsEntry(
          context.scope,
          targetFile,
          item.category,
          item.name
        )
        const wasAdded = updateOpencodeInstructions(configPath, entryValue)
        return { path: configPath, alreadyInstalled: !wasAdded }
      }
      return { path: targetFile, alreadyInstalled: false }
    }

    case 'directory-skill': {
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

    case 'section': {
      const mdPath = context.configPath ?? targetFile
      const sourceTag = `<source>${item.path}</source>`

      const { body } = parseFrontmatter(item.rawContent)
      const section = `\n## ${item.title}\n\n${sourceTag}\n\n${body.trimEnd()}\n`

      if (existsSync(mdPath) && readFileSync(mdPath, 'utf-8').includes(sourceTag)) {
        return { path: mdPath, alreadyInstalled: true }
      }

      appendFileSync(mdPath, section, 'utf-8')
      return { path: mdPath, alreadyInstalled: false }
    }
  }
}

export const uninstall = (agent: Agent, item: EngineItem, context: EngineContext): boolean => {
  const entry = getLayoutEntry(agent, item.category, context.scope)
  const targetFile = resolveContentFile(entry, context.baseDir, item.name)

  switch (entry.format) {
    case 'file': {
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

    case 'directory-skill': {
      const skillDir = dirname(targetFile)
      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true, force: true })
        return true
      }
      return false
    }

    case 'section': {
      const mdPath = context.configPath ?? targetFile
      if (!existsSync(mdPath)) return false

      const content = readFileSync(mdPath, 'utf-8')
      const sourceTag = `<source>${item.path}</source>`
      if (!content.includes(sourceTag)) return false

      const { result, count } = removeSections(content, text => text.includes(sourceTag))
      if (count === 0) return false
      writeFileSync(mdPath, result, 'utf-8')
      return true
    }
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

const listFromSkillDir = (baseDir: string, category: Category): InstalledItem[] => {
  if (!isDirectory(baseDir)) return []
  const results: InstalledItem[] = []

  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillFile = resolve(baseDir, entry.name, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    let title: string | null = null
    try {
      const content = readFileSync(skillFile, 'utf-8')
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (fmMatch) {
        const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m)
        const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m)
        title = nameMatch?.[1]?.trim() || descMatch?.[1]?.trim() || null
      }
    } catch {
      // ignore read errors
    }
    results.push({ path: `${category}/${entry.name}`, title, category })
  }
  return results
}

const listFromSections = (mdPath: string, category: Category): InstalledItem[] => {
  if (!existsSync(mdPath)) return []
  const content = readFileSync(mdPath, 'utf-8')
  const results: InstalledItem[] = []
  const sectionRegex = /^## (.+)$\n(?:.|\n)*?^<source>([\w-]+\/[\w./-]+)<\/source>/gm

  for (const match of content.matchAll(sectionRegex)) {
    const sourcePath = match[2]
    const [rawCategory] = sourcePath.split('/')
    const itemCategory = (CATEGORIES as string[]).includes(rawCategory)
      ? (rawCategory as Category)
      : category
    results.push({ path: sourcePath, title: match[1].trim(), category: itemCategory })
  }
  return results
}

export const list = (agent: Agent, context: EngineContext): InstalledItem[] => {
  const results: InstalledItem[] = []

  for (const category of getSupportedCategories(agent, context.scope)) {
    const entry = getLayoutEntry(agent, category, context.scope)
    const targetFile = resolveContentFile(entry, context.baseDir, 'placeholder')

    switch (entry.format) {
      case 'file':
        results.push(...listFromFileDir(dirname(targetFile), category))
        break
      case 'directory-skill':
        results.push(...listFromSkillDir(dirname(dirname(targetFile)), category))
        break
      case 'section':
        results.push(...listFromSections(context.configPath ?? targetFile, category))
        break
    }
  }

  return results
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
    // The shared-section skip is preserved until the behaviour-fix step.
    if (getLayoutEntry(agent, item.category, context.scope).format === 'section') continue

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
