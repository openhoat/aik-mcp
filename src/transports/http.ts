import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { logger } from '../logger.js'

type TransportMap = Map<string, StreamableHTTPServerTransport>

interface ParsedBody {
  method?: string
}

const readBody = (req: IncomingMessage): Promise<string> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

const sendError = (res: ServerResponse, status: number, message: string): void => {
  res.writeHead(status)
  res.end(message)
}

const getSessionId = (req: IncomingMessage): string | undefined =>
  typeof req.headers['mcp-session-id'] === 'string' ? req.headers['mcp-session-id'] : undefined

const readParsedBody = async (req: IncomingMessage): Promise<ParsedBody | undefined> => {
  const body = req.method === 'POST' ? await readBody(req) : undefined
  return body ? (JSON.parse(body) as ParsedBody) : undefined
}

const createTransport = (transports: TransportMap): StreamableHTTPServerTransport => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sid: string) => {
      transports.set(sid, transport)
      logger.info({ sessionId: sid }, 'HTTP: session initialized')
    },
  })

  transport.onclose = () => {
    const sid = transport.sessionId
    if (sid) {
      transports.delete(sid)
      logger.info({ sessionId: sid }, 'HTTP: session closed')
    }
  }

  return transport
}

const handleDelete = async (
  transports: TransportMap,
  transport: StreamableHTTPServerTransport | undefined,
  sessionId: string | undefined,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  logger.info({ sessionId }, 'HTTP: deleting session')
  if (!transport) {
    sendError(res, 400, 'Invalid or missing session ID')
    return
  }
  await transport.handleRequest(req, res)
  if (sessionId) transports.delete(sessionId)
}

const handleMcpRequest = async (
  server: McpServer,
  transports: TransportMap,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  const sessionId = getSessionId(req)
  const transport = sessionId ? transports.get(sessionId) : undefined

  if (req.method === 'DELETE') {
    await handleDelete(transports, transport, sessionId, req, res)
    return
  }

  if (transport) {
    const parsed = await readParsedBody(req)
    logger.trace({ sessionId, method: parsed?.method }, 'HTTP: request')
    await transport.handleRequest(req, res, parsed)
    return
  }

  const parsed = await readParsedBody(req)
  if (parsed?.method !== 'initialize') {
    sendError(res, 400, 'Bad Request: initialization required')
    return
  }

  const created = createTransport(transports)
  await server.connect(created)
  await created.handleRequest(req, res, parsed)
}

export const startHttpTransport = async (server: McpServer, port: number): Promise<void> => {
  const transports: TransportMap = new Map()

  const httpServer = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, { status: 'ok', server: 'aik' })
        return
      }

      if (!req.url?.startsWith('/mcp')) {
        sendError(res, 404, 'Not Found')
        return
      }

      await handleMcpRequest(server, transports, req, res)
    } catch (err) {
      logger.error({ err }, 'HTTP request handler error')
      if (!res.headersSent) {
        sendError(res, 500, 'Internal Server Error')
      }
    }
  })

  httpServer.listen(port)
}
