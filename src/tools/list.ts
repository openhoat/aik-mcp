import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import type { ToolRegistrar } from './shared.js'

const VALID_CATEGORIES = ['rules', 'skills', 'workflows', 'agents', 'commands', 'templates']

export function registerListTool(server: McpServer, store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'aik_list',
    'List available content items (rules, skills, workflows, agents, commands, templates)',
    {
      category: z.string().optional().describe('Filter by content category'),
      tag: z.string().optional().describe('Filter by tag'),
      query: z.string().optional().describe('Filter by text query in title/description'),
    },
    async ({ category, tag, query }: { category?: string; tag?: string; query?: string }) => {
      logger.trace({ category, tag, query }, 'aik_list called')
      let items = store.getAll()

      if (category) {
        if (!VALID_CATEGORIES.includes(category)) {
          return {
            content: [
              {
                type: 'text',
                text: `Invalid category "${category}". Valid: ${VALID_CATEGORIES.join(', ')}`,
              },
            ],
            isError: true,
          }
        }
        items = items.filter(i => i.category === category)
      }
      if (tag) {
        items = items.filter(i => i.tags.includes(tag))
      }
      if (query) {
        const q = query.toLowerCase()
        items = items.filter(
          i => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
        )
      }

      const result = items.map(i => ({
        path: i.path,
        category: i.category,
        name: i.name,
        title: i.title,
        description: i.description,
        tags: i.tags,
        version: i.version,
        compatibility: i.compatibility,
      }))

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )
}
