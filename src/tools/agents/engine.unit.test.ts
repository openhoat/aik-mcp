import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { install, list, readVersion, uninstall, uninstallAll } from './engine.js'
import {
  type Agent,
  getAllAgents,
  getLayoutEntry,
  getSupportedCategories,
  resolveContentFile,
} from './factory.js'
import { CATEGORIES, type Category, type Scope } from './types.js'

const RAW = `---
title: Sample
description: A sample item
version: 2.3.4
tags: [test]
---

# Sample

body
`

const tempDirs: string[] = []

const makeBaseDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'aik-engine-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

const itemFor = (category: Category, name = 'sample') => ({
  path: `${category}/${name}`,
  category,
  name,
  title: 'Sample',
  rawContent: RAW,
})

const contextFor = (scope: Scope, baseDir: string) => ({
  scope,
  baseDir,
  configPath: null,
})

const expectedVersion = (agent: Agent, category: Category, scope: Scope): string | null => {
  const entry = getLayoutEntry(agent, category, scope)
  if (entry.format === 'section') return null
  if (entry.configUpdate === 'opencode-instructions') return '1.0.0'
  return '2.3.4'
}

describe('engine contract matrix', () => {
  for (const agent of getAllAgents()) {
    for (const scope of ['project', 'global'] as Scope[]) {
      for (const category of CATEGORIES) {
        const supported = getSupportedCategories(agent, scope).includes(category)

        if (!supported) {
          test(`${agent} / ${scope} / ${category}: unsupported is rejected`, () => {
            expect(() => getLayoutEntry(agent, category, scope)).toThrow()
          })
          continue
        }

        test(`${agent} / ${scope} / ${category}: install → read → list → uninstall round-trips`, () => {
          const baseDir = makeBaseDir()
          const context = contextFor(scope, baseDir)
          const item = itemFor(category)

          const entry = getLayoutEntry(agent, category, scope)
          // A shared-section file lives in an existing config directory (the
          // agent is detected by that file), so the parent must already exist.
          if (entry.format === 'section') {
            mkdirSync(dirname(resolveContentFile(entry, baseDir, item.name)), { recursive: true })
          }

          const installed = install(agent, item, context)
          expect(installed.alreadyInstalled).toBe(false)

          expect(readVersion(agent, item, context)).toBe(expectedVersion(agent, category, scope))

          const listed = list(agent, context)
          expect(listed.map(i => i.path)).toContain(item.path)
          expect(listed.find(i => i.path === item.path)?.category).toBe(category)

          expect(uninstall(agent, item, context)).toBe(true)
          expect(list(agent, context).map(i => i.path)).not.toContain(item.path)
        })
      }
    }
  }
})

describe('engine install is idempotent', () => {
  test('file format reports already installed on the second install', () => {
    const baseDir = makeBaseDir()
    const context = contextFor('project', baseDir)
    const item = itemFor('rules')

    expect(install('opencode', item, context).alreadyInstalled).toBe(false)
    expect(install('opencode', item, context).alreadyInstalled).toBe(true)
  })

  test('directory-skill reports already installed on the second install', () => {
    const baseDir = makeBaseDir()
    const context = contextFor('project', baseDir)
    const item = itemFor('skills')

    expect(install('claude-code', item, context).alreadyInstalled).toBe(false)
    expect(install('claude-code', item, context).alreadyInstalled).toBe(true)
  })

  test('section reports already installed on the second install', () => {
    const baseDir = makeBaseDir()
    const context = contextFor('project', baseDir)
    const item = itemFor('rules')

    expect(install('codex', item, context).alreadyInstalled).toBe(false)
    expect(install('codex', item, context).alreadyInstalled).toBe(true)
  })
})

describe('engine uninstallAll', () => {
  test('is a composition of list then uninstall for file and skill formats', () => {
    const baseDir = makeBaseDir()
    const context = contextFor('project', baseDir)

    install('claude-code', itemFor('rules', 'one'), context)
    install('claude-code', itemFor('rules', 'two'), context)
    install('claude-code', itemFor('skills', 'three'), context)

    expect(uninstallAll('claude-code', context)).toBe(3)
    expect(list('claude-code', context)).toEqual([])
  })

  test('removes shared-section items', () => {
    const baseDir = makeBaseDir()
    const context = contextFor('project', baseDir)
    const entry = getLayoutEntry('codex', 'rules', 'project')
    // The shared section file lives in the project root; the project is detected
    // by AGENTS.md, which the install creates.
    mkdirSync(dirname(resolveContentFile(entry, baseDir, 'sample')), { recursive: true })

    install('codex', itemFor('rules', 'one'), context)
    install('codex', itemFor('rules', 'two'), context)
    expect(list('codex', context).length).toBe(2)

    expect(uninstallAll('codex', context)).toBe(2)
    expect(list('codex', context)).toEqual([])
  })
})
