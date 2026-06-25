import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import type { ToolRegistrar } from './shared.js'

export function registerDeleteTool(server: McpServer, store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'delete',
    'Delete a content item by its path',
    {
      path: z
        .string()
        .describe('Path to the content item to delete (e.g. "rules/coding-standards")'),
    },
    async ({ path }: { path: string }) => {
      logger.trace({ path }, 'delete called')
      try {
        const deleted = await store.deleteContent(path)
        if (!deleted) {
          return { content: [{ type: 'text', text: `Content not found: ${path}` }], isError: true }
        }
        return { content: [{ type: 'text', text: `Deleted: ${path}` }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        }
      }
    }
  )
}
