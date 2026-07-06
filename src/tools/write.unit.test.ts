import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test } from 'vitest'
import type { ContentStore } from '../content-store.js'

// Tool handlers return { content: [...] } with optional isError.
// See list.test.ts for the reasoning behind these type aliases.
type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

vi.mock('../logger.js', () => ({
  logger: { trace: vi.fn() },
}))

import { registerWriteTool } from './write.js'

const createMockContentItem = (overrides: Record<string, unknown> = {}) => {
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

const setup = (writeResult: ReturnType<typeof createMockContentItem>) => {
  // Partial mock — only implements methods used by the tool handler
  const store = {
    writeContent: vi
      .fn<
        (
          path: string,
          content: string,
          frontmatter: Record<string, unknown>,
          overwrite: boolean
        ) => Promise<ReturnType<typeof createMockContentItem>>
      >()
      .mockResolvedValue(writeResult),
  } as unknown as ContentStore // Safe: test mock type limitation

  let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  const server = {
    registerTool: (_name: string, _config: Record<string, unknown>, cb: typeof handler) => {
      handler = cb
      return server
    },
  } as unknown as McpServer // Safe: test mock type limitation

  registerWriteTool(server, store)

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

  test('should reject when required fields are missing', async () => {
    const item = createMockContentItem({ title: 'untitled', description: '', tags: [] })
    const { handler, store } = setup(item)
    const result = (await handler({ path: 'rules/test-rule', content: '# Test' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('title')
    expect(store.writeContent).not.toHaveBeenCalled()
  })

  test('should reject when required fields are empty', async () => {
    const item = createMockContentItem()
    const { handler, store } = setup(item)
    const result = (await handler({
      path: 'rules/test-rule',
      content: '# Test',
      title: '',
      description: 'A description',
      tags: ['test'],
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('title')
    expect(store.writeContent).not.toHaveBeenCalled()
  })

  test('should reject when tags are empty', async () => {
    const item = createMockContentItem()
    const { handler, store } = setup(item)
    const result = (await handler({
      path: 'rules/test-rule',
      content: '# Test',
      title: 'Test Rule',
      description: 'A description',
      tags: [],
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('tags')
    expect(store.writeContent).not.toHaveBeenCalled()
  })

  test('should pass overwrite flag', async () => {
    const item = createMockContentItem()
    const { handler, store } = setup(item)
    await handler({
      path: 'rules/test-rule',
      content: '# Test',
      title: 'Test Rule',
      description: 'A description',
      tags: ['test'],
      overwrite: true,
    })
    expect(store.writeContent).toHaveBeenCalledWith(
      'rules/test-rule',
      '# Test',
      { title: 'Test Rule', description: 'A description', tags: ['test'] },
      true
    )
  })

  test('should handle store error', async () => {
    const store = {
      writeContent: vi
        .fn<
          (
            path: string,
            content: string,
            frontmatter: Record<string, unknown>,
            overwrite: boolean
          ) => Promise<ReturnType<typeof createMockContentItem>>
        >()
        .mockRejectedValue(new Error('Write failed')),
    } as unknown as ContentStore // Safe: test mock type limitation

    let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
    const server = {
      registerTool: (_name: string, _config: Record<string, unknown>, cb: typeof handler) => {
        handler = cb
        return server
      },
    } as unknown as McpServer // Safe: test mock type limitation

    registerWriteTool(server, store)

    const result = (await handler!({
      path: 'rules/test-rule',
      content: '# Test',
      title: 'Test Rule',
      description: 'A description',
      tags: ['test'],
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Write failed')
  })
})
