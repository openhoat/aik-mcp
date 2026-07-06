import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test } from 'vitest'

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn() },
}))

import { startStdioTransport } from './stdio.js'

describe('startStdioTransport', () => {
  test('should connect server with stdio transport', async () => {
    const connect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const server = { connect } as unknown as McpServer // Safe: test mock type limitation

    await startStdioTransport(server)

    expect(connect).toHaveBeenCalledTimes(1)
  })
})
