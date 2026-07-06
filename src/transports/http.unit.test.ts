import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, type Mock, test } from 'vitest'

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
}))

const mockTransportHandleRequest = vi.fn().mockResolvedValue(undefined)
let capturedOnsessioninitialized: ((sid: string) => void) | undefined
let capturedSessionIdGenerator: (() => string) | undefined

const MockTransport = vi.fn(function MockTransport(
  this: { handleRequest: Mock; onclose: (() => void) | undefined; sessionId: string },
  opts: { sessionIdGenerator: () => string; onsessioninitialized: (sid: string) => void }
) {
  capturedOnsessioninitialized = opts.onsessioninitialized
  capturedSessionIdGenerator = opts.sessionIdGenerator
  this.handleRequest = mockTransportHandleRequest
  this.onclose = undefined
  this.sessionId = opts.sessionIdGenerator()
})

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: MockTransport,
}))

let capturedHandler:
  | ((req: IncomingMessage, res: ServerResponse) => void | Promise<void>)
  | undefined
const mockListen = vi.fn()

vi.mock('node:http', () => ({
  createServer: vi.fn(
    (handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => {
      capturedHandler = handler
      return { listen: mockListen }
    }
  ),
}))

const { startHttpTransport } = await import('./http.js')

const createMockRes = (): ServerResponse => {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
    headersSent: false,
  } as unknown as ServerResponse // Safe: test mock type limitation
}

const createMockReq = (
  url: string,
  method: string,
  headers?: Record<string, string>
): IncomingMessage => {
  return { method, url, headers: headers ?? {}, on: vi.fn() } as unknown as IncomingMessage // Safe: test mock type limitation
}

const createMockReqWithBody = (
  url: string,
  body: string,
  headers?: Record<string, string>
): IncomingMessage => {
  const ee = new EventEmitter()
  Object.assign(ee, { method: 'POST', url, headers: headers ?? {} })
  queueMicrotask(() => {
    ee.emit('data', Buffer.from(body))
    ee.emit('end')
  })
  return ee as unknown as IncomingMessage // Safe: test mock type limitation
}

describe('startHttpTransport', () => {
  let server: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer
  let connect: Mock<() => Promise<void>>

  beforeEach(() => {
    vi.clearAllMocks()
    capturedHandler = undefined
    capturedOnsessioninitialized = undefined
    capturedSessionIdGenerator = undefined
    connect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    server = { connect } as unknown as import('@modelcontextprotocol/sdk/server/mcp.js').McpServer
  })

  describe('server setup', () => {
    test('should create HTTP server and listen on given port', async () => {
      await startHttpTransport(server, 3456)

      expect(mockListen).toHaveBeenCalledWith(3456)
    })

    test('should pass request handler to createServer', async () => {
      await startHttpTransport(server, 3456)

      expect(capturedHandler).toEqual(expect.any(Function))
    })
  })

  describe('request handler', () => {
    beforeEach(async () => {
      await startHttpTransport(server, 3456)
    })

    test('GET /health returns 200 with status', async () => {
      const req = createMockReq('/health', 'GET')
      const res = createMockRes()

      await capturedHandler!(req, res)

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok', server: 'aik' }))
    })

    test('non-MCP route returns 404', async () => {
      const req = createMockReq('/some-other-path', 'GET')
      const res = createMockRes()

      await capturedHandler!(req, res)

      expect(res.writeHead).toHaveBeenCalledWith(404)
      expect(res.end).toHaveBeenCalledWith('Not Found')
    })

    test('POST /mcp without initialize returns 400', async () => {
      const req = createMockReqWithBody('/mcp', JSON.stringify({ method: 'ping' }))
      const res = createMockRes()

      await capturedHandler!(req, res)

      expect(res.writeHead).toHaveBeenCalledWith(400)
      expect(res.end).toHaveBeenCalledWith('Bad Request: initialization required')
    })

    test('POST /mcp with initialize creates transport and connects', async () => {
      const req = createMockReqWithBody('/mcp', JSON.stringify({ method: 'initialize' }))
      const res = createMockRes()

      await capturedHandler!(req, res)

      expect(MockTransport).toHaveBeenCalledTimes(1)
      expect(connect).toHaveBeenCalledTimes(1)
      expect(mockTransportHandleRequest).toHaveBeenCalledTimes(1)
    })

    test('DELETE without session header returns 400', async () => {
      const req = createMockReq('/mcp', 'DELETE')
      const res = createMockRes()

      await capturedHandler!(req, res)

      expect(res.writeHead).toHaveBeenCalledWith(400)
      expect(res.end).toHaveBeenCalledWith('Invalid or missing session ID')
    })

    test('handler errors return 500', async () => {
      const req = createMockReqWithBody('/mcp', '{invalid json}')
      const res = createMockRes()

      await capturedHandler!(req, res)

      expect(res.writeHead).toHaveBeenCalledWith(500)
      expect(res.end).toHaveBeenCalledWith('Internal Server Error')
    })

    test('onsessioninitialized callback is provided to transport', async () => {
      const req = createMockReqWithBody('/mcp', JSON.stringify({ method: 'initialize' }))
      const res = createMockRes()

      await capturedHandler!(req, res)

      expect(capturedOnsessioninitialized).toEqual(expect.any(Function))
      expect(capturedSessionIdGenerator).toEqual(expect.any(Function))
    })

    test('onsessioninitialized stores transport in map', async () => {
      const req = createMockReqWithBody('/mcp', JSON.stringify({ method: 'initialize' }))
      const res = createMockRes()

      await capturedHandler!(req, res)

      // Simulate session initialization
      capturedOnsessioninitialized!('test-session-id')
      // Should not throw
    })

    test('onclose removes transport from map', async () => {
      const req = createMockReqWithBody('/mcp', JSON.stringify({ method: 'initialize' }))
      const res = createMockRes()

      await capturedHandler!(req, res)

      // Simulate session close
      if (MockTransport.mock.calls.length > 0) {
        const transport = MockTransport.mock.results[0]?.value
        if (transport?.onclose) {
          transport.sessionId = 'test-session-id'
          transport.onclose()
        }
      }
      // Should not throw
    })

    test('DELETE with valid session calls transport handleRequest', async () => {
      // First create a session
      const initReq = createMockReqWithBody('/mcp', JSON.stringify({ method: 'initialize' }))
      const initRes = createMockRes()
      await capturedHandler!(initReq, initRes)

      // Simulate session initialization
      capturedOnsessioninitialized!('test-session-id')

      // Now DELETE with that session
      const delReq = createMockReq('/mcp', 'DELETE', { 'mcp-session-id': 'test-session-id' })
      const delRes = createMockRes()

      await capturedHandler!(delReq, delRes)

      expect(mockTransportHandleRequest).toHaveBeenCalled()
    })

    test('POST with existing session reuses transport', async () => {
      // First create a session
      const initReq = createMockReqWithBody('/mcp', JSON.stringify({ method: 'initialize' }))
      const initRes = createMockRes()
      await capturedHandler!(initReq, initRes)

      capturedOnsessioninitialized!('test-session-id')

      // Now POST with that session
      const postReq = createMockReqWithBody('/mcp', JSON.stringify({ method: 'ping' }), {
        'mcp-session-id': 'test-session-id',
      })
      const postRes = createMockRes()

      await capturedHandler!(postReq, postRes)

      expect(mockTransportHandleRequest).toHaveBeenCalledTimes(2)
    })

    test('error handler without headers sent returns 500', async () => {
      const req = createMockReqWithBody('/mcp', '{invalid}')
      const res = createMockRes()

      await capturedHandler!(req, res)

      expect(res.writeHead).toHaveBeenCalledWith(500)
      expect(res.end).toHaveBeenCalledWith('Internal Server Error')
    })
  })
})
