import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import type { ToolRegistrar } from './shared.js'

export function registerGetTool(server: McpServer, store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'get',
    'Retrieve a specific content item by its path (e.g. "rules/coding-standards")',
    { path: z.string().describe('Path to the content item (e.g. "rules/coding-standards")') },
    async ({ path }: { path: string }) => {
      logger.trace({ path }, 'get called')
      const item = store.getByPath(path)
      if (!item) {
        return { content: [{ type: 'text', text: `Content not found: ${path}` }], isError: true }
      }

      const result = {
        path: item.path,
        category: item.category,
        name: item.name,
        title: item.title,
        description: item.description,
        tags: item.tags,
        version: item.version,
        compatibility: item.compatibility,
        author: item.author,
        created: item.created,
        updated: item.updated,
        content: item.content,
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )
}
