import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage } from 'node:http'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { logger } from '../logger.js'

const readBody = (req: IncomingMessage): Promise<string> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

export const startHttpTransport = async (server: McpServer, port: number): Promise<void> => {
  const transports = new Map<string, StreamableHTTPServerTransport>()

  const httpServer = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', server: 'aik' }))
        return
      }

      if (!req.url?.startsWith('/mcp')) {
        res.writeHead(404)
        res.end('Not Found')
        return
      }

      const sessionId: string | undefined =
        typeof req.headers['mcp-session-id'] === 'string'
          ? req.headers['mcp-session-id']
          : undefined
      let transport = sessionId ? transports.get(sessionId) : undefined

      if (req.method === 'DELETE') {
        logger.info({ sessionId }, 'HTTP: deleting session')
        if (transport) {
          await transport.handleRequest(req, res)
          if (sessionId) transports.delete(sessionId)
        } else {
          res.writeHead(400)
          res.end('Invalid or missing session ID')
        }
        return
      }

      if (!transport) {
        const body = req.method === 'POST' ? await readBody(req) : undefined
        const parsed = body ? JSON.parse(body) : undefined

        if (parsed?.method !== 'initialize') {
          res.writeHead(400)
          res.end('Bad Request: initialization required')
          return
        }

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            if (transport) {
              transports.set(sid, transport)
              logger.info({ sessionId: sid }, 'HTTP: session initialized')
            }
          },
        })

        transport.onclose = () => {
          const sid = transport?.sessionId
          if (sid) {
            transports.delete(sid)
            logger.info({ sessionId: sid }, 'HTTP: session closed')
          }
        }

        await server.connect(transport)
        await transport.handleRequest(req, res, parsed)
        return
      }

      const body = req.method === 'POST' ? await readBody(req) : undefined
      const parsed = body ? JSON.parse(body) : undefined
      logger.trace({ sessionId, method: parsed?.method }, 'HTTP: request')
      await transport.handleRequest(req, res, parsed)
    } catch (err) {
      logger.error({ err }, 'HTTP request handler error')
      if (!res.headersSent) {
        res.writeHead(500)
        res.end('Internal Server Error')
      }
    }
  })

  httpServer.listen(port)
}
