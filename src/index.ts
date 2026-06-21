#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadConfig } from './config.js'
import { ContentStore } from './content-store.js'
import { logger } from './logger.js'
import { registerResources } from './resources/index.js'
import { registerDeleteTool } from './tools/delete.js'
import { registerGetTool } from './tools/get.js'
import { registerInstallTool, registerReinstallTool } from './tools/install.js'
import { registerListTool } from './tools/list.js'
import { registerListInstalledTool } from './tools/list-installed.js'
import { registerSearchTool } from './tools/search.js'
import { registerUninstallTool } from './tools/uninstall.js'
import { registerWriteTool } from './tools/write.js'
import { startHttpTransport } from './transports/http.js'
import { startStdioTransport } from './transports/stdio.js'

const config = loadConfig(process.argv.slice(2))

logger.info(
  { contentDir: config.contentDir, http: config.http, port: config.port, watch: config.watch },
  'starting aik server'
)

const store = new ContentStore(config)

await store.init()

logger.info(
  {
    itemCount: store.getAll().length,
    categories: [...new Set(store.getAll().map(i => i.category))],
  },
  'content store initialized'
)

const server = new McpServer({
  name: 'aik',
  version: '1.0.0',
  description:
    'MCP server for AI knowledge repository — query rules, skills, workflows, agents, commands, and templates',
})

registerListTool(server, store)
registerGetTool(server, store)
registerInstallTool(server, store)
registerReinstallTool(server, store)
registerListInstalledTool(server, store)
registerSearchTool(server, store)
registerUninstallTool(server, store)
registerWriteTool(server, store)
registerDeleteTool(server, store)
registerResources(server, store)

if (config.http) {
  logger.info({ port: config.port }, 'starting HTTP transport')
  await startHttpTransport(server, config.port)
} else {
  logger.info('starting stdio transport')
  await startStdioTransport(server)
}
