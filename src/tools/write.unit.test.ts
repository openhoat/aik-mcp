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

import { registerWriteTool } from './write.js'

function createMockContentItem(overrides: Record<string, unknown> = {}) {
  return {
    path: 'rules/test-rule',
    category: 'rules',
    name: 'test-rule',
    title: 'Test Rule',
    description: 'A description',
    tags: ['test'],
    ...overrides,
  }
}

function setup(writeResult: ReturnType<typeof createMockContentItem>) {
  // Partial mock — only implements methods used by the tool handler
  const store = {
    writeContent: jest
      .fn<
        (
          path: string,
          content: string,
          frontmatter: Record<string, unknown>,
          overwrite: boolean
        ) => Promise<ReturnType<typeof createMockContentItem>>
      >()
      .mockResolvedValue(writeResult),
  } as unknown as ContentStore

  let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  // Partial mock — only implements the `tool` registration method
  const server = {
    tool: (_name: string, _desc: string, _schema: Record<string, unknown>, cb: typeof handler) => {
      handler = cb
      return server
    },
  } as unknown as McpServer

  registerWriteTool(server, store)

  // handler is guaranteed non-null after registerWriteTool calls server.tool
  return { store, handler: handler! }
}

describe('registerWriteTool', () => {
  test('should create a new item', async () => {
    const item = createMockContentItem()
    const { handler, store } = setup(item)
    const result = (await handler({
      path: 'rules/test-rule',
      content: '# Test',
      title: 'Test Rule',
      description: 'A description',
      tags: ['test'],
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.path).toBe('rules/test-rule')
    expect(store.writeContent).toHaveBeenCalledWith(
      'rules/test-rule',
      '# Test',
      { title: 'Test Rule', description: 'A description', tags: ['test'] },
      false
    )
  })

  test('should create item without optional fields', async () => {
    const item = createMockContentItem({ title: 'untitled', description: '', tags: [] })
    const { handler, store } = setup(item)
    await handler({ path: 'rules/test-rule', content: '# Test' })
    expect(store.writeContent).toHaveBeenCalledWith('rules/test-rule', '# Test', {}, false)
  })

  test('should pass overwrite flag', async () => {
    const item = createMockContentItem()
    const { handler, store } = setup(item)
    await handler({ path: 'rules/test-rule', content: '# Test', overwrite: true })
    expect(store.writeContent).toHaveBeenCalledWith('rules/test-rule', '# Test', {}, true)
  })

  test('should handle store error', async () => {
    const store = {
      writeContent: jest
        .fn<
          (
            path: string,
            content: string,
            frontmatter: Record<string, unknown>,
            overwrite: boolean
          ) => Promise<ReturnType<typeof createMockContentItem>>
        >()
        .mockRejectedValue(new Error('Write failed')),
    } as unknown as ContentStore

    let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
    const server = {
      tool: (
        _name: string,
        _desc: string,
        _schema: Record<string, unknown>,
        cb: typeof handler
      ) => {
        handler = cb
        return server
      },
    } as unknown as McpServer

    registerWriteTool(server, store)

    const result = (await handler!({
      path: 'rules/test-rule',
      content: '# Test',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Write failed')
  })
})
