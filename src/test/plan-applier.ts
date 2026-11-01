import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { parse as parseJsonc, stringify as stringifyJsonc } from 'comment-json'
import { removeSection } from '../tools/agents/engine.js'
import type { InstallPlan, PlanAction } from '../tools/agents/plan.js'

// Test-only materializer: applies a plan the way a client agent is told to, so
// the parity test can prove that apply(plan) produces exactly what the direct
// engine writes. It is deliberately independent from the planner: it reads the
// plan like a third party would, and knows no agent table.

interface ConfigFile {
  [key: string]: unknown
}

const toHomePath = (absolutePath: string): string => {
  const home = homedir()
  return home && absolutePath.startsWith(home)
    ? `~${absolutePath.slice(home.length)}`
    : absolutePath
}

// The value an instruction entry must hold: relative to the project root for the
// project scope, tilde-absolute for the global scope.
const entryValue = (plan: InstallPlan, relativePath: string, baseDir: string): string =>
  plan.scope === 'project' ? relativePath : toHomePath(join(baseDir, relativePath))

const resolveConfigFile = (candidates: string[], baseDir: string): string => {
  const found = candidates.find(candidate => existsSync(join(baseDir, candidate)))
  return join(baseDir, found ?? candidates[0])
}

const readConfig = (file: string): ConfigFile => {
  if (!existsSync(file)) return {}
  // Safe: test fixture, the config is a JSON object
  return parseJsonc(readFileSync(file, 'utf-8')) as ConfigFile
}

const writeConfig = (file: string, config: ConfigFile): void => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${stringifyJsonc(config, null, 2)}\n`, 'utf-8')
}

const updateConfigEntry = (
  plan: InstallPlan,
  action: Extract<PlanAction, { op: 'config_entry_add' | 'config_entry_remove' }>,
  baseDir: string
): void => {
  const file = resolveConfigFile(action.candidates, baseDir)
  const config = readConfig(file)
  const current = Array.isArray(config[action.key]) ? (config[action.key] as string[]) : []
  const value = entryValue(plan, action.path, baseDir)

  config[action.key] =
    action.op === 'config_entry_add'
      ? current.includes(value)
        ? current
        : [...current, value]
      : current.filter(entry => entry !== value)

  writeConfig(file, config)
}

const applyAction = (plan: InstallPlan, action: PlanAction, baseDir: string): void => {
  switch (action.op) {
    case 'write_file': {
      const target = join(baseDir, action.path)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, action.content, 'utf-8')
      return
    }
    case 'install_skill': {
      const dir = join(baseDir, action.dir)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, action.skillMd.relPath), action.skillMd.content, 'utf-8')
      for (const asset of action.assets) {
        const target = join(dir, asset.relPath)
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(
          target,
          asset.encoding === 'base64' ? Buffer.from(asset.content, 'base64') : asset.content
        )
      }
      return
    }
    case 'section_upsert': {
      const target = join(baseDir, action.file)
      const current = existsSync(target) ? readFileSync(target, 'utf-8') : ''
      if (current.includes(action.marker)) return
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(
        target,
        `${current}\n${action.heading}\n\n${action.marker}\n\n${action.content}\n`,
        'utf-8'
      )
      return
    }
    case 'section_remove': {
      const target = join(baseDir, action.file)
      if (!existsSync(target)) return
      const { result } = removeSection(readFileSync(target, 'utf-8'), action.marker)
      writeFileSync(target, result, 'utf-8')
      return
    }
    case 'delete_file': {
      const target = join(baseDir, action.path)
      if (existsSync(target)) unlinkSync(target)
      return
    }
    case 'delete_dir': {
      rmSync(join(baseDir, action.path), { recursive: true, force: true })
      return
    }
    case 'config_entry_add':
    case 'config_entry_remove':
      updateConfigEntry(plan, action, baseDir)
  }
}

export const applyPlan = (plan: InstallPlan, baseDir: string): void => {
  mkdirSync(baseDir, { recursive: true })
  for (const action of plan.actions) applyAction(plan, action, baseDir)
}
