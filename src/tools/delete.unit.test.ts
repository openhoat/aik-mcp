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

import { registerDeleteTool } from './delete.js'

function setup(deleted: boolean) {
  // Partial mock — only implements methods used by the tool handler
  const store = {
    deleteContent: jest.fn<(path: string) => Promise<boolean>>().mockResolvedValue(deleted),
  } as unknown as ContentStore

  let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  // Partial mock — only implements the `tool` registration method
  const server = {
    tool: (_name: string, _desc: string, _schema: Record<string, unknown>, cb: typeof handler) => {
      handler = cb
      return server
    },
  } as unknown as McpServer

  registerDeleteTool(server, store)

  // handler is guaranteed non-null after registerDeleteTool calls server.tool
  return { store, handler: handler! }
}

describe('registerDeleteTool', () => {
  test('should return success when item deleted', async () => {
    const { handler } = setup(true)
    const result = (await handler({ path: 'rules/test-rule' })) as ToolContent
    expect(result.content[0].text).toBe('Deleted: rules/test-rule')
  })

  test('should return error when item not found', async () => {
    const { handler } = setup(false)
    const result = (await handler({ path: 'rules/nonexistent' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Content not found')
  })

  test('should handle store error', async () => {
    const store = {
      deleteContent: jest
        .fn<(path: string) => Promise<boolean>>()
        .mockRejectedValue(new Error('Delete failed')),
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

    registerDeleteTool(server, store)

    const result = (await handler!({ path: 'rules/test-rule' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Delete failed')
  })
})
