import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test } from 'vitest'
import type { ContentItem, ContentStore } from '../content-store.js'

type ToolContent = { content: Array<{ type: string; text: string }> }

vi.mock('../logger.js', () => ({
  logger: { trace: vi.fn() },
}))

import { registerSearchTool } from './search.js'

const createItem = (overrides: Partial<ContentItem> = {}): ContentItem => {
  return {
    path: 'rules/test-rule',
    fullPath: '/tmp/rules/test-rule.md',
    category: 'rules',
    name: 'test-rule',
    title: 'Test Rule',
    description: 'A test rule description',
    tags: ['test', 'typescript'],
    version: '1.0.0',
    compatibility: ['opencode'],
    author: 'test',
    created: '2026-01-01',
    updated: '2026-07-04',
    content: 'Content body',
    ...overrides,
  }
}

const setup = (items: ContentItem[]) => {
  const store = {
    getAll: vi.fn<() => ContentItem[]>().mockReturnValue(items),
  } as unknown as ContentStore // Safe: test mock type limitation

  let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  const server = {
    registerTool: (_name: string, _config: Record<string, unknown>, cb: typeof handler) => {
      handler = cb
      return server
    },
  } as unknown as McpServer // Safe: test mock type limitation

  registerSearchTool(server, store)

  return { store, handler: handler! }
}

describe('registerSearchTool', () => {
  test('should return matching results', async () => {
    const { handler } = setup([createItem({ title: 'UniqueTitle123' })])
    const result = (await handler({ query: 'UniqueTitle123' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].title).toBe('UniqueTitle123')
    expect(parsed[0].path).toBe('rules/test-rule')
  })

  test('should return empty array when no match', async () => {
    const { handler } = setup([createItem({ title: 'Alpha' })])
    const result = (await handler({ query: 'NonExistentQuery' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(0)
  })

  test('should filter by category', async () => {
    const { handler } = setup([
      createItem({ path: 'rules/rule-a', category: 'rules', title: 'Rule A' }),
      createItem({ path: 'skills/skill-b', category: 'skills', title: 'Skill B' }),
    ])
    const result = (await handler({ query: '', category: 'rules' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].path).toBe('rules/rule-a')
  })

  test('should respect limit parameter', async () => {
    const { handler } = setup([
      createItem({ path: 'rules/rule-1', title: 'Rule 1' }),
      createItem({ path: 'rules/rule-2', title: 'Rule 2' }),
      createItem({ path: 'rules/rule-3', title: 'Rule 3' }),
    ])
    const result = (await handler({ query: '', limit: 2 })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.length).toBeLessThanOrEqual(2)
  })

  test('should format result fields correctly', async () => {
    const item = createItem({
      title: 'Formatted Item',
      description: 'Formatted description',
      tags: ['tag1'],
      version: '2.0.0',
      compatibility: ['opencode', 'claude-code'],
    })
    const { handler } = setup([item])
    const result = (await handler({ query: 'Formatted' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed[0]).toMatchObject({
      path: item.path,
      category: item.category,
      name: item.name,
      title: item.title,
      description: item.description,
      tags: item.tags,
      version: item.version,
      compatibility: item.compatibility,
    })
    expect(typeof parsed[0].score).toBe('number')
  })
})
