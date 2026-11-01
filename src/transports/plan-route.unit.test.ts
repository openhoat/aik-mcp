import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, test, vi } from 'vitest'
import type { ContentItem, ContentStore } from '../content-store.js'
import { createPlanRoute } from './plan-route.js'

const README = `---
title: Demo Rule
description: A demo item
tags: [test]
version: "2.0.0"
---

# Demo Rule

Body.
`

const roots: string[] = []

const createItem = (path: string): ContentItem => {
  const [category, ...rest] = path.split('/')
  const root = mkdtempSync(join(tmpdir(), 'aik-plan-route-'))
  roots.push(root)
  const fullPath = join(root, category, ...rest, 'README.md')
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, README, 'utf-8')

  return {
    path,
    fullPath,
    category: category as ContentItem['category'],
    name: rest.join('/'),
    title: 'Demo Rule',
    description: 'A demo item',
    tags: ['test'],
    version: '2.0.0',
    compatibility: [],
    appliesTo: [],
    requires: [],
    author: '',
    created: '',
    updated: '',
    content: README,
    assets: [],
  }
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

const createRes = () => {
  const res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse
  return {
    res,
    status: () => (res.writeHead as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0],
    body: () => (res.end as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0],
  }
}

const createStore = (items: ContentItem[]): ContentStore =>
  ({
    getByPath: (path: string) => items.find(item => item.path === path),
    readContent: (path: string) => items.find(item => item.path === path)?.content ?? null,
  }) as unknown as ContentStore

const url = (path: string): URL => new URL(path, 'http://localhost')

describe('GET /plan/<item>', () => {
  test('returns the installation plan as JSON', async () => {
    const route = createPlanRoute(createStore([createItem('rules/demo')]))
    const res = createRes()

    await route.handle(url('/plan/rules/demo?agent=opencode&scope=global'), res.res)

    expect(res.status()).toBe(200)
    expect(JSON.parse(res.body() as string)).toEqual(
      expect.objectContaining({
        planVersion: 1,
        operation: 'install',
        agent: 'opencode',
        scope: 'global',
        base: { kind: 'agent-global', hint: '~/.config/opencode' },
      })
    )
  })

  test('accepts a trailing .md and a trailing slash', async () => {
    const route = createPlanRoute(createStore([createItem('rules/demo')]))
    const res = createRes()

    await route.handle(url('/plan/rules/demo.md/'), res.res)

    expect(res.status()).toBe(200)
    expect(JSON.parse(res.body() as string).item.path).toBe('rules/demo')
  })

  test('rejects an unknown item, agent or scope', async () => {
    const route = createPlanRoute(createStore([createItem('rules/demo')]))

    const missing = createRes()
    await route.handle(url('/plan/rules/missing'), missing.res)
    expect(missing.status()).toBe(404)

    const badAgent = createRes()
    await route.handle(url('/plan/rules/demo?agent=unknown'), badAgent.res)
    expect(badAgent.status()).toBe(400)

    const badScope = createRes()
    await route.handle(url('/plan/rules/demo?scope=elsewhere'), badScope.res)
    expect(badScope.status()).toBe(400)
  })

  test('rejects a category the agent does not support in that scope', async () => {
    const route = createPlanRoute(createStore([createItem('rules/demo')]))
    const res = createRes()

    await route.handle(url('/plan/rules/demo?agent=copilot&scope=global'), res.res)

    expect(res.status()).toBe(400)
    expect(res.body()).toContain('not supported for global scope')
  })

  test('only matches the plan prefix', () => {
    const route = createPlanRoute(createStore([]))

    expect(route.match(url('/plan/rules/demo'))).toBe(true)
    expect(route.match(url('/mcp'))).toBe(false)
    expect(route.match(url('/health'))).toBe(false)
  })
})
