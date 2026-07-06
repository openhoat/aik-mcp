import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test } from 'vitest'
import type { ContentStore } from '../content-store.js'

// Tool handlers return { content: [...] } with optional isError.
// These type aliases make the inline `as` assertions readable.
type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

vi.mock('../logger.js', () => ({
  logger: { trace: vi.fn() },
}))

import { registerListTool } from './list.js'

const createMockContentItem = (overrides: Record<string, unknown> = {}) => {
  return {
    path: 'rules/test-rule',
    category: 'rules',
    name: 'test-rule',
    title: 'Test Rule',
    description: 'A test rule',
    tags: ['test'],
    version: '1.0.0',
    compatibility: ['opencode', 'claude-code', 'cline'],
    content: '# Test\ncontent',
    ...overrides,
  }
}

const setup = (items: ReturnType<typeof createMockContentItem>[] = []) => {
  // Partial mock — only implements methods used by the tool handler
  const store = { getAll: vi.fn().mockReturnValue(items) } as unknown as ContentStore // Safe: test mock type limitation

  let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  const server = {
    registerTool: (_name: string, _config: Record<string, unknown>, cb: typeof handler) => {
      handler = cb
      return server
    },
  } as unknown as McpServer // Safe: test mock type limitation

  registerListTool(server, store)

  return { store, handler: handler! }
}

describe('registerListTool', () => {
  test('should return all items', async () => {
    const items = [
      createMockContentItem(),
      createMockContentItem({ path: 'skills/test-skill', category: 'skills' }),
    ]
    const { handler } = setup(items)
    const result = (await handler({})) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(2)
  })

  test('should filter by category', async () => {
    const items = [
      createMockContentItem(),
      createMockContentItem({ path: 'skills/test-skill', category: 'skills', name: 'test-skill' }),
    ]
    const { handler } = setup(items)
    const result = (await handler({ category: 'rules' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].category).toBe('rules')
  })

  test('should return error for invalid category', async () => {
    const { handler } = setup()
    const result = (await handler({ category: 'invalid' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Invalid category')
  })

  test('should filter by tag', async () => {
    const items = [
      createMockContentItem({ tags: ['test'] }),
      createMockContentItem({ path: 'rules/other', name: 'other', tags: ['other'] }),
    ]
    const { handler } = setup(items)
    const result = (await handler({ tag: 'test' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe('test-rule')
  })

  test('should filter by text query', async () => {
    const items = [
      createMockContentItem({ title: 'TypeScript Guide' }),
      createMockContentItem({ path: 'rules/other', name: 'other', title: 'Other Thing' }),
    ]
    const { handler } = setup(items)
    const result = (await handler({ query: 'typescript' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(1)
  })

  test('should combine filters', async () => {
    const items = [
      createMockContentItem({ tags: ['test'] }),
      createMockContentItem({
        path: 'skills/test-skill',
        category: 'skills',
        name: 'test-skill',
        tags: ['test'],
      }),
    ]
    const { handler } = setup(items)
    const result = (await handler({ category: 'rules', tag: 'test' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].category).toBe('rules')
  })
})
