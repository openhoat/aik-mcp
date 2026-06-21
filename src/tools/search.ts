import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { SearchEngine } from '../search.js'
import type { ToolRegistrar } from './shared.js'

export function registerSearchTool(server: McpServer, store: ContentStore): void {
  const engine = new SearchEngine()

  ;(server.tool as unknown as ToolRegistrar)(
    'aik_search',
    'Full-text fuzzy search across all content items',
    {
      query: z.string().describe('Search query'),
      category: z
        .string()
        .optional()
        .describe(
          'Restrict search to a category (rules, skills, workflows, agents, commands, templates)'
        ),
      limit: z.number().min(1).max(50).optional().default(20).describe('Maximum results'),
    },
    async ({ query, category, limit }: { query: string; category?: string; limit?: number }) => {
      logger.trace({ query, category, limit }, 'aik_search called')
      engine.buildIndex(store.getAll())
      const results = engine.search({ query, category, limit })

      const items = results.map(r => ({
        score: r.score,
        path: r.item.path,
        category: r.item.category,
        name: r.item.name,
        title: r.item.title,
        description: r.item.description,
        tags: r.item.tags,
        version: r.item.version,
        compatibility: r.item.compatibility,
      }))

      return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] }
    }
  )
}
