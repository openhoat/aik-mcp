import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { applyPlan } from '../../test/plan-applier.js'
import { type EngineContext, type EngineItem, install, uninstall } from './engine.js'
import { type Agent, getAllAgents, getSupportedCategories } from './factory.js'
import { planInstall, planUninstall } from './plan.js'
import type { Category, Scope } from './types.js'

// Parity harness: the plan must produce exactly the bytes the direct engine
// writes, for every agent, scope, category and materialization format. This is
// the agnosticism guard: any agent-specific assumption leaking out of the
// planner (a hard-coded path, a missing format) breaks the matrix, not just the
// opencode case.

const roots: string[] = []

const tempDir = (label: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `aik-plan-${label}-`))
  roots.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
})

const SCOPES: Scope[] = ['project', 'global']

const readTree = (baseDir: string): Record<string, string> => {
  const files: Record<string, string> = {}
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      files[relative(baseDir, full).split(sep).join('/')] = readFileSync(full, 'utf-8')
    }
  }
  if (roots.length >= 0) walk(baseDir)
  return files
}

// Config entries point at the real base directory, which differs between the two
// roots by construction: normalize it so the comparison is about the shape of
// the installation, not about the temporary directory names.
const normalizeTree = (tree: Record<string, string>, baseDir: string): Record<string, string> =>
  Object.fromEntries(
    Object.entries(tree).map(([file, content]) => [file, content.split(baseDir).join('<base>')])
  )

interface Fixture {
  item: EngineItem
  contentDir: string
}

const README = `---
title: Demo Item
description: A demo item used by the parity tests
tags: [test]
version: "1.2.0"
compatibility: [opencode, claude-code, cline]
---

# Demo Item

Body content of the demo item.
`

// A skill bundle also carries assets: one text, one binary, both must travel
// through the plan unchanged.
const createFixture = (category: Category, name: string): Fixture => {
  const contentDir = tempDir('content')
  const bundle = join(contentDir, category, name)
  mkdirSync(join(bundle, 'assets'), { recursive: true })
  writeFileSync(join(bundle, 'README.md'), README, 'utf-8')
  writeFileSync(join(bundle, 'assets', 'note.txt'), 'plain text asset\n', 'utf-8')
  writeFileSync(join(bundle, 'assets', 'blob.bin'), Buffer.from([0, 1, 2, 250, 251, 252]))

  return {
    contentDir,
    item: {
      path: `${category}/${name}`,
      category,
      name,
      title: 'Demo Item',
      rawContent: README,
      sourceDir: bundle,
    },
  }
}

const directContext = (scope: Scope, baseDir: string): EngineContext => ({
  scope,
  baseDir,
  configPath: null,
})

const cases = (): Array<{ agent: Agent; scope: Scope; category: Category }> => {
  const list: Array<{ agent: Agent; scope: Scope; category: Category }> = []
  for (const agent of getAllAgents()) {
    for (const scope of SCOPES) {
      for (const category of getSupportedCategories(agent, scope)) {
        list.push({ agent, scope, category })
      }
    }
  }
  return list
}

describe('plan parity with the direct engine', () => {
  const matrix = cases()

  test('the matrix covers every agent and both scopes', () => {
    const agents = new Set(matrix.map(c => c.agent))
    expect([...agents].sort()).toEqual([...getAllAgents()].sort())
    expect(matrix.some(c => c.scope === 'project')).toBe(true)
    expect(matrix.some(c => c.scope === 'global')).toBe(true)
    // Every format of the engine is covered at least once.
    expect(matrix.length).toBeGreaterThanOrEqual(20)
  })

  for (const { agent, scope, category } of matrix) {
    test(`install parity: ${agent} / ${scope} / ${category}`, () => {
      const { item } = createFixture(category, `demo-${agent}-${scope}-${category}`)
      const directBase = tempDir('direct')
      const planBase = tempDir('plan')

      install(agent, item, directContext(scope, directBase))
      applyPlan(planInstall(agent, item, { scope }), planBase)

      expect(normalizeTree(readTree(planBase), planBase)).toEqual(
        normalizeTree(readTree(directBase), directBase)
      )
    })
  }

  for (const { agent, scope, category } of matrix) {
    test(`uninstall parity: ${agent} / ${scope} / ${category}`, () => {
      const { item } = createFixture(category, `demo-un-${agent}-${scope}-${category}`)
      const directBase = tempDir('direct')
      const planBase = tempDir('plan')

      install(agent, item, directContext(scope, directBase))
      applyPlan(planInstall(agent, item, { scope }), planBase)

      uninstall(agent, item, directContext(scope, directBase))
      applyPlan(planUninstall(agent, item, { scope }), planBase)

      expect(normalizeTree(readTree(planBase), planBase)).toEqual(
        normalizeTree(readTree(directBase), directBase)
      )
    })
  }
})

describe('plan payload', () => {
  test('carries a sha256 for every file it asks to write', () => {
    const { item } = createFixture('skills', 'demo-hashes')
    const plan = planInstall('claude-code', item, { scope: 'project' })
    const skill = plan.actions[0]

    expect(skill.op).toBe('install_skill')
    if (skill.op !== 'install_skill') return
    expect(skill.skillMd.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(skill.assets.map(a => a.relPath)).toEqual(['assets/blob.bin', 'assets/note.txt'])
    expect(skill.assets.find(a => a.relPath.endsWith('blob.bin'))?.encoding).toBe('base64')
    expect(skill.assets.find(a => a.relPath.endsWith('note.txt'))?.encoding).toBe('utf8')
  })

  test('names no absolute path and no server machine state', () => {
    for (const { agent, scope, category } of cases()) {
      const { item } = createFixture(category, `demo-paths-${agent}-${scope}-${category}`)
      const plan = planInstall(agent, item, { scope })
      const serialized = JSON.stringify(plan)

      expect(plan.base.kind).toBe(scope === 'global' ? 'agent-global' : 'project')
      expect(serialized).not.toContain(tmpdir())
      expect(serialized).not.toContain(item.sourceDir as string)
    }
  })

  test('is idempotent on re-install: same plan, no duplicate config entry', () => {
    const { item } = createFixture('rules', 'demo-idempotent')
    const first = planInstall('opencode', item, { scope: 'global' })
    const base = tempDir('idem')

    applyPlan(first, base)
    applyPlan(planInstall('opencode', item, { scope: 'global' }), base)

    const config = readFileSync(join(base, 'opencode.json'), 'utf-8')
    expect(config.match(/instructions/g)?.length).toBe(1)
    expect(config).toContain('rules/demo-idempotent.md')
  })
})
