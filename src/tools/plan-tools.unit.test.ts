import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { afterAll, describe, expect, test } from 'vitest'
import type { ContentItem, ContentStore } from '../content-store.js'
import { registerInstallPlanTool } from './install.js'
import { registerLayoutTool } from './layout.js'
import { registerUninstallPlanTool } from './uninstall.js'
import { registerCheckUpdatesPlanTool } from './update.js'

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean }
type Handler = (args: Record<string, unknown>) => Promise<ToolResult>

const createServer = () => {
  const handlers = new Map<string, Handler>()
  const server = {
    registerTool: (name: string, _config: unknown, cb: Handler) => {
      handlers.set(name, cb)
    },
  } as unknown as McpServer
  const tool = (name: string): Handler => handlers.get(name) as Handler
  return { server, tool }
}

const roots: string[] = []

const contentDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'aik-plan-tools-'))
  roots.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
})

const README = `---
title: Demo Rule
description: A demo item
tags: [test]
version: "2.0.0"
---

# Demo Rule

Body.
`

interface ItemOptions {
  path?: string
  appliesTo?: string[]
  requires?: string[]
  assets?: string[]
}

const createItem = (options: ItemOptions = {}): ContentItem => {
  const path = options.path ?? 'rules/demo'
  const [category, ...rest] = path.split('/')
  const root = contentDir()
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
    appliesTo: options.appliesTo ?? [],
    requires: options.requires ?? [],
    author: '',
    created: '',
    updated: '',
    content: README,
    assets: options.assets ?? [],
  }
}

const createStore = (items: ContentItem[]): ContentStore =>
  ({
    getByPath: (path: string) => items.find(item => item.path === path),
    readContent: (path: string) => items.find(item => item.path === path)?.content ?? null,
  }) as unknown as ContentStore

const json = (result: ToolResult): Record<string, unknown> => {
  expect(result.isError).toBeUndefined()
  return JSON.parse(result.content[0].text)
}

describe('install (plan mode)', () => {
  const setup = (options: ItemOptions = {}) => {
    const item = createItem(options)
    const { server, tool } = createServer()
    registerInstallPlanTool(server, createStore([item]))
    return { item, handler: tool('install') }
  }

  test('plans a rule file plus the agent config entry', async () => {
    const { handler } = setup()
    const plan = json(await handler({ path: 'rules/demo', agent: 'opencode' }))

    expect(plan.planVersion).toBe(1)
    expect(plan.operation).toBe('install')
    expect(plan.base).toEqual({ kind: 'project', hint: expect.stringContaining('project root') })
    expect(plan.actions).toEqual([
      {
        op: 'write_file',
        path: '.opencode/rules/demo.md',
        content: README,
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      {
        op: 'config_entry_add',
        key: 'instructions',
        candidates: ['.opencode/opencode.jsonc'],
        path: '.opencode/rules/demo.md',
      },
    ])
  })

  test('plans a section for an agent whose rules live in a shared file', async () => {
    const { handler } = setup()
    const plan = json(await handler({ path: 'rules/demo', agent: 'codex', scope: 'global' }))
    const actions = plan.actions as Record<string, unknown>[]

    expect(plan.base).toEqual({ kind: 'agent-global', hint: '$CODEX_HOME or ~/.codex' })
    expect(actions).toHaveLength(1)
    expect(actions[0].op).toBe('section_upsert')
    expect(actions[0].file).toBe('AGENTS.md')
    expect(actions[0].marker).toBe('<source>rules/demo</source>')
    expect(actions[0].heading).toBe('## Demo Rule')
    expect(actions[0].content).toBe('# Demo Rule\n\nBody.')
  })

  test('plans a skill directory with its assets', async () => {
    const { item, handler } = setup({ path: 'skills/demo', assets: ['scripts/run.mjs'] })
    const assetFile = join(dirname(item.fullPath), 'scripts', 'run.mjs')
    mkdirSync(dirname(assetFile), { recursive: true })
    writeFileSync(assetFile, 'console.log(1)\n', 'utf-8')

    const plan = json(await handler({ path: 'skills/demo', agent: 'claude-code' }))
    const [action] = plan.actions as Record<string, unknown>[]
    const skill = action as { op: string; dir: string; assets: Record<string, string>[] }

    expect(skill.op).toBe('install_skill')
    expect(skill.dir).toBe('.claude/skills/demo')
    expect(skill.assets).toEqual([
      {
        relPath: 'scripts/run.mjs',
        content: 'console.log(1)\n',
        encoding: 'utf8',
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    ])
  })

  test('blocks on a stack mismatch reported by the client', async () => {
    const { handler } = setup({ appliesTo: ['python'] })
    const result = await handler({
      path: 'rules/demo',
      agent: 'opencode',
      projectInfo: { stacks: ['nodejs'], mcpServers: null },
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('applies to [python]')
  })

  test('only warns when the client reports nothing', async () => {
    const { handler } = setup({ appliesTo: ['python'] })
    const plan = json(await handler({ path: 'rules/demo', agent: 'opencode' }))

    expect(plan.warnings).toEqual([expect.stringContaining('Could not detect the project stack')])
  })

  test('reports unknown content and unsupported categories', async () => {
    const { handler } = setup()

    expect((await handler({ path: 'rules/missing', agent: 'opencode' })).isError).toBe(true)
    expect((await handler({ path: 'rules/demo', agent: 'copilot', scope: 'global' })).isError).toBe(
      true
    )
  })

  test('honours an explicit config path', async () => {
    const { handler } = setup()
    const plan = json(
      await handler({ path: 'rules/demo', agent: 'opencode', configPath: 'opencode.json' })
    )

    expect(plan.actions).toContainEqual(
      expect.objectContaining({ op: 'config_entry_add', candidates: ['opencode.json'] })
    )
  })
})

describe('uninstall (plan mode)', () => {
  test('plans the file, the config removal and the skill directory', async () => {
    const item = createItem({ path: 'skills/demo' })
    const { server, tool } = createServer()
    const store = createStore([item])
    registerUninstallPlanTool(server, store)
    const handler = tool('uninstall')

    const skillPlan = json(await handler({ path: 'skills/demo', agent: 'claude-code' }))
    expect(skillPlan.actions).toEqual([{ op: 'delete_dir', path: '.claude/skills/demo' }])

    const opencodePlan = json(await handler({ path: 'skills/demo', agent: 'opencode' }))
    expect(opencodePlan.actions).toEqual([{ op: 'delete_dir', path: '.opencode/skills/demo' }])
  })

  test('plans a section removal for a shared-file agent', async () => {
    const item = createItem()
    const { server, tool } = createServer()
    registerUninstallPlanTool(server, createStore([item]))

    const plan = json(await tool('uninstall')({ path: 'rules/demo', agent: 'codex' }))
    expect(plan.actions).toEqual([
      { op: 'section_remove', file: 'AGENTS.md', marker: '<source>rules/demo</source>' },
    ])
  })

  test('plans a rule removal with its config entry', async () => {
    const item = createItem()
    const { server, tool } = createServer()
    registerUninstallPlanTool(server, createStore([item]))
    const handler = tool('uninstall')

    const plan = json(await handler({ path: 'rules/demo', agent: 'opencode', scope: 'global' }))
    expect(plan.actions).toEqual([
      {
        op: 'config_entry_remove',
        key: 'instructions',
        candidates: ['opencode.json', 'opencode.jsonc'],
        path: 'rules/demo.md',
      },
      { op: 'delete_file', path: 'rules/demo.md' },
    ])
  })

  test('rejects an invalid path', async () => {
    const { server, tool } = createServer()
    registerUninstallPlanTool(server, createStore([]))
    const handler = tool('uninstall')
    const result = await handler({ path: 'nonsense', agent: 'opencode' })
    expect(result.isError).toBe(true)
  })
})

describe('check_updates (inventory mode)', () => {
  const setup = () => {
    const item = createItem()
    const { server, tool } = createServer()
    registerCheckUpdatesPlanTool(server, createStore([item]))
    return tool('check_updates')
  }

  test('compares the local inventory with the knowledge base', async () => {
    const handler = setup()
    const report = json(
      await handler({
        items: [
          { path: 'rules/demo', version: '1.0.0' },
          { path: 'rules/demo', version: '2.0.0' },
          { path: 'rules/gone', version: '3.0.0' },
        ],
      })
    )

    expect(report.updateCount).toBe(1)
    expect(report.updates).toEqual([
      { path: 'rules/demo', installedVersion: '1.0.0', storeVersion: '2.0.0' },
    ])
    expect(report.unknown).toEqual(['rules/gone'])
  })
})

describe('layout', () => {
  test('exposes every agent table as data', async () => {
    const { server, tool } = createServer()
    registerLayoutTool(server, createStore([]))
    const report = json(await tool('layout')({}))
    const agents = report.agents as Record<string, unknown>[]
    const opencode = agents.find(agent => agent.agent === 'opencode') as {
      project: { categories: Record<string, Record<string, string>> }
      global: { base: string; categories: Record<string, Record<string, string>> }
    }
    const copilot = agents.find(agent => agent.agent === 'copilot') as {
      global: unknown
    }

    expect(opencode.project.categories.rules.dir).toBe('.opencode/rules')
    expect(opencode.project.categories.rules.configUpdate).toBe('opencode-instructions')
    expect(opencode.global.base).toBe('~/.config/opencode')
    expect(copilot.global).toBeNull()
  })
})
