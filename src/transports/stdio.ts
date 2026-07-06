import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { logger } from '../logger.js'

export const startStdioTransport = async (server: McpServer): Promise<void> => {
  const transport = new StdioServerTransport()
  logger.info('connecting stdio transport...')
  await server.connect(transport)
}
