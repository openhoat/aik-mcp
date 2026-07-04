import { describe, expect, jest, test } from '@jest/globals'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

jest.mock('../logger.js', () => ({
  logger: { info: jest.fn() },
}))

import { startStdioTransport } from './stdio.js'

describe('startStdioTransport', () => {
  test('should connect server with stdio transport', async () => {
    const connect = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const server = { connect } as unknown as McpServer

    await startStdioTransport(server)

    expect(connect).toHaveBeenCalledTimes(1)
  })
})
