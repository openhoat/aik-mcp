import { describe, expect, type Mock, test } from 'vitest'

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
}))

const mockListen = vi.fn()
const mockCreateServer = vi.fn(() => ({ listen: mockListen }))

vi.mock('node:http', () => ({
  createServer: mockCreateServer,
}))

const { startHttpTransport } = await import('./http.js')

describe('startHttpTransport', () => {
  let server: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer
  let connect: Mock<() => Promise<void>>

  beforeEach(() => {
    vi.clearAllMocks()
    connect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
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
