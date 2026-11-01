import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { parse as parseJsonc, stringify as stringifyJsonc } from 'comment-json'
import type { InstallPlan, PlanAction, PlanFile } from './plan.js'
import { buildSection, findSection, sectionPresent } from './section.js'

// Applier for installation plans.
//
// The remote transport plans an installation instead of performing it, because a
// server running elsewhere cannot write on the client's machine. This module is
// the client half: it reads a plan as a third party would (it knows no agent
// table, no aik internals) and performs the operations in the base directory the
// plan designates.
//
// It ships with the package and backs the `aik-apply` command, so a shell client
// applies a plan byte-for-byte without passing the content through a model.

export interface ApplyOptions {
  /**
   * Base directory override. The project scope defaults to the current working
   * directory; the global scope is resolved from the plan's own hint.
   */
  base?: string
  /** Report what would happen without touching the disk. */
  dryRun?: boolean
  /** Receives one line per action, as it is applied. */
  log?: (message: string) => void
}

export interface ApplyResult {
  base: string
  applied: number
  skipped: number
  messages: string[]
}

const sha256 = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex')

const expandTilde = (path: string): string => {
  if (path === '~') return homedir()
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path
}

// `$VAR`, `${VAR}` and `~` are expanded; an unset variable stays in the string,
// which is how the resolver below knows the candidate does not apply here.
const expandVars = (path: string): string =>
  path.replace(/\$\{(\w+)\}|\$(\w+)/g, (match, braced, bare) => {
    return process.env[braced ?? bare] ?? match
  })

const HINT_SEPARATOR = /\s+or\s+/

/**
 * Turn a plan base hint into a local directory.
 *
 * Hints are written for a human: `~/.claude`, `~/Documents/Cline/Rules
 * (fallback: ~/Cline/Rules)`, `$CODEX_HOME or ~/.codex`. Alternatives are tried
 * in order, and a candidate whose variable is unset is skipped rather than
 * resolved to an empty path.
 */
export const expandBaseHint = (hint: string): string => {
  const primary = hint.split('(fallback')[0]?.trim() ?? ''
  for (const candidate of primary.split(HINT_SEPARATOR)) {
    const trimmed = candidate.trim().replace(/\/+$/, '')
    if (!trimmed) continue
    const expanded = expandTilde(expandVars(trimmed))
    // An unset or empty variable leaves `$` behind: the candidate does not apply
    // here, try the next one rather than resolving to an empty path.
    if (!expanded.trim() || expanded.includes('$')) continue
    return resolve(expanded)
  }
  throw new Error(
    `cannot resolve the base hint "${hint}": set the variable it names, or pass a base directory`
  )
}

/** Base directory a plan applies to, on this machine. */
export const resolveBaseDir = (plan: InstallPlan, override?: string): string => {
  if (override) return resolve(expandTilde(expandVars(override)))
  if (plan.base.kind === 'project') return process.cwd()
  return expandBaseHint(plan.base.hint)
}

const resolveTarget = (baseDir: string, path: string): string => {
  const expanded = expandTilde(expandVars(path))
  return isAbsolute(expanded) ? expanded : join(baseDir, expanded)
}

const toHomePath = (absolutePath: string): string => {
  const home = homedir()
  return home && absolutePath.startsWith(home)
    ? `~${absolutePath.slice(home.length)}`
    : absolutePath
}

const verify = (expected: string, data: Buffer | string, label: string): void => {
  const actual = sha256(data)
  if (actual !== expected) {
    throw new Error(`sha256 mismatch on ${label}: plan says ${expected}, content is ${actual}`)
  }
}

const writeVerified = (target: string, data: Buffer | string, expected: string): void => {
  // Verify before writing: a corrupt plan must not leave a half-applied install.
  verify(expected, data, target)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, data)
}

const writePlanFile = (dir: string, file: PlanFile): string => {
  const target = join(dir, file.relPath)
  writeVerified(target, decodePlanFile(file), file.sha256)
  return target
}

const decodePlanFile = (file: PlanFile): Buffer | string =>
  file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content

const readText = (path: string): string => {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

const resolveConfigFile = (candidates: string[], baseDir: string): string => {
  const found = candidates.find(candidate => existsSync(resolveTarget(baseDir, candidate)))
  return resolveTarget(baseDir, found ?? (candidates[0] as string))
}

interface JsonConfig {
  [key: string]: unknown
}

const readConfig = (path: string): JsonConfig => {
  const text = readText(path)
  if (!text.trim()) return {}
  // Safe: comment-json parses JSON with comments into a plain object.
  return parseJsonc(text) as JsonConfig
}

// The value an instruction entry must hold: relative to the project root for the
// project scope, tilde-absolute for the global scope (a config file shared across
// machines must not carry this machine's home directory).
const configEntryValue = (plan: InstallPlan, relativePath: string, baseDir: string): string =>
  plan.scope === 'project' ? relativePath : toHomePath(resolveTarget(baseDir, relativePath))

interface ActionOutcome {
  message: string
  applied: boolean
}

const applyAction = (
  plan: InstallPlan,
  action: PlanAction,
  baseDir: string,
  options: ApplyOptions
): ActionOutcome => {
  switch (action.op) {
    case 'write_file': {
      const target = resolveTarget(baseDir, action.path)
      if (options.dryRun) {
        verify(action.sha256, action.content, target)
      } else {
        writeVerified(target, action.content, action.sha256)
      }
      return { message: `write_file ${target}`, applied: true }
    }

    case 'install_skill': {
      const dir = resolveTarget(baseDir, action.dir)
      const entry = join(dir, action.skillMd.relPath)
      if (existsSync(entry)) {
        return { message: `install_skill ${dir} (already installed, skipped)`, applied: false }
      }
      if (options.dryRun) {
        verify(action.skillMd.sha256, decodePlanFile(action.skillMd), entry)
        for (const asset of action.assets)
          verify(asset.sha256, decodePlanFile(asset), asset.relPath)
      } else {
        writePlanFile(dir, action.skillMd)
        for (const asset of action.assets) writePlanFile(dir, asset)
      }
      return { message: `install_skill ${dir} (${action.assets.length} asset(s))`, applied: true }
    }

    case 'section_upsert': {
      const file = resolveTarget(baseDir, action.file)
      if (sectionPresent(readText(file), action.marker)) {
        return { message: `section_upsert ${file} (already present, skipped)`, applied: false }
      }
      verify(action.sha256, action.content, file)
      if (!options.dryRun) {
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(
          file,
          `${readText(file)}${buildSection(action.heading, action.marker, action.content)}`,
          'utf-8'
        )
      }
      return { message: `section_upsert ${file}`, applied: true }
    }

    case 'section_remove': {
      const file = resolveTarget(baseDir, action.file)
      const content = readText(file)
      const range = findSection(content, action.marker)
      if (!range) {
        if (!content.includes(action.marker)) {
          return { message: `section_remove ${file} (absent, nothing to do)`, applied: false }
        }
      }
      if (!options.dryRun && content) {
        writeFileSync(file, removeMarkerBlock(content, action.marker), 'utf-8')
      }
      return { message: `section_remove ${file}`, applied: true }
    }

    case 'delete_file': {
      const target = resolveTarget(baseDir, action.path)
      if (!existsSync(target)) {
        return { message: `delete_file ${target} (absent, nothing to do)`, applied: false }
      }
      if (!options.dryRun) unlinkSync(target)
      return { message: `delete_file ${target}`, applied: true }
    }

    case 'delete_dir': {
      const target = resolveTarget(baseDir, action.path)
      if (!existsSync(target)) {
        return { message: `delete_dir ${target} (absent, nothing to do)`, applied: false }
      }
      if (!options.dryRun) rmSync(target, { recursive: true, force: true })
      return { message: `delete_dir ${target}`, applied: true }
    }

    case 'config_entry_add':
    case 'config_entry_remove': {
      const file = resolveConfigFile(action.candidates, baseDir)
      const config = readConfig(file)
      const current = Array.isArray(config[action.key]) ? (config[action.key] as string[]) : []
      const value = configEntryValue(plan, action.path, baseDir)
      const adding = action.op === 'config_entry_add'
      const present = current.includes(value)

      if (adding === present) {
        return { message: `${action.op} ${action.key} in ${file} (no change)`, applied: false }
      }

      if (!options.dryRun) {
        config[action.key] = adding ? [...current, value] : current.filter(entry => entry !== value)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, `${stringifyJsonc(config, null, 2)}\n`, 'utf-8')
      }
      return { message: `${action.op} ${action.key} in ${file}`, applied: true }
    }

    default: {
      // Safe: the switch is exhaustive over PlanAction; the cast surfaces the
      // unexpected operation (a plan from a newer planVersion) as a clear error.
      const unknown = action as { op?: string }
      throw new Error(`unknown plan operation "${unknown.op}": upgrade aik-apply`)
    }
  }
}

// Removal through the shared section rules, with the engine's legacy fallback for
// a marker that is not the opening line of its heading.
const removeMarkerBlock = (content: string, marker: string): string => {
  const range = findSection(content, marker)
  if (range) {
    const lines = content.split('\n')
    return [...lines.slice(0, range.start), ...lines.slice(range.end)].join('\n')
  }
  const lines = content.split('\n')
  const start = lines.findIndex(
    (line, index) => line.startsWith('## ') && lines.slice(index).join('\n').includes(marker)
  )
  if (start < 0) return content
  let end = start + 1
  while (end < lines.length && !(lines[end] as string).startsWith('## ')) end++
  return [...lines.slice(0, start), ...lines.slice(end)].join('\n')
}

/** Apply a plan. Throws on a corrupt payload or an unknown operation. */
export const applyPlan = (plan: InstallPlan, options: ApplyOptions = {}): ApplyResult => {
  const baseDir = resolveBaseDir(plan, options.base)
  const messages: string[] = []
  let applied = 0
  let skipped = 0

  for (const action of plan.actions) {
    const outcome = applyAction(plan, action, baseDir, options)
    applied += outcome.applied ? 1 : 0
    skipped += outcome.applied ? 0 : 1
    messages.push(outcome.message)
    options.log?.(outcome.message)
  }

  return { base: baseDir, applied, skipped, messages }
}

/** One-line description of a plan, for a CLI header. */
export const describePlan = (plan: InstallPlan): string =>
  `${plan.operation} ${plan.item.path} for ${plan.agent} (${plan.scope})`
