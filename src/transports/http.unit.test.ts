import { describe, expect, jest, test } from '@jest/globals'

jest.mock('../logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() },
}))

const mockListen = jest.fn()
const mockCreateServer = jest.fn(() => ({ listen: mockListen }))

jest.unstable_mockModule('node:http', () => ({
  createServer: mockCreateServer,
}))

const { startHttpTransport } = await import('./http.js')

describe('startHttpTransport', () => {
  let server: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer
  let connect: jest.Mock<() => Promise<void>>

  beforeEach(() => {
    jest.clearAllMocks()
    connect = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    server = { connect } as unknown as import('@modelcontextprotocol/sdk/server/mcp.js').McpServer
  })

  test('should create HTTP server and listen on given port', async () => {
    await startHttpTransport(server, 3456)

    expect(mockCreateServer).toHaveBeenCalledTimes(1)
    expect(mockListen).toHaveBeenCalledWith(3456)
  })

  test('should pass request handler to createServer', async () => {
    await startHttpTransport(server, 3456)

    expect(mockCreateServer).toHaveBeenCalledWith(expect.any(Function))
  })
})
