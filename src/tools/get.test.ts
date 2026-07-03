import { describe, expect, jest, test } from '@jest/globals'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ContentStore } from '../content-store.js'

// Tool handlers return { content: [...] } with optional isError.
// See list.test.ts for the reasoning behind these type aliases.
type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

jest.mock('../logger.js', () => ({
  logger: { trace: jest.fn() },
}))

import { registerGetTool } from './get.js'

function createMockContentItem(overrides: Record<string, unknown> = {}) {
  return {
    path: 'rules/test-rule',
    category: 'rules',
    name: 'test-rule',
    title: 'Test Rule',
    description: 'A test rule',
    tags: ['test'],
    version: '1.0.0',
    compatibility: ['opencode', 'claude-code', 'cline'],
    author: undefined,
    created: undefined,
    updated: undefined,
    content: '# Test\ncontent',
    ...overrides,
  }
}

function setup(item: ReturnType<typeof createMockContentItem> | null) {
  // Partial mock — only implements methods used by the tool handler
  const store = { getByPath: jest.fn().mockReturnValue(item) } as unknown as ContentStore

  let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  // Partial mock — only implements the `tool` registration method
  const server = {
    tool: (_name: string, _desc: string, _schema: Record<string, unknown>, cb: typeof handler) => {
      handler = cb
      return server
    },
  } as unknown as McpServer

  registerGetTool(server, store)

  // handler is guaranteed non-null after registerGetTool calls server.tool
  return { store, handler: handler! }
}

describe('registerGetTool', () => {
  test('should return item when found', async () => {
    const item = createMockContentItem()
    const { handler } = setup(item)
    const result = (await handler({ path: 'rules/test-rule' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.path).toBe('rules/test-rule')
    expect(parsed.title).toBe('Test Rule')
    expect(parsed.content).toBe('# Test\ncontent')
  })

  test('should return error when item not found', async () => {
    const { handler } = setup(null)
    const result = (await handler({ path: 'rules/nonexistent' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Content not found')
  })
})
