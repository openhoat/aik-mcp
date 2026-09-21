import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { detectStacks } from '../project-stack.js'
import { SearchEngine } from '../search.js'
export const registerSearchTool = (server: McpServer, store: ContentStore): void => {
  const engine = new SearchEngine()

  server.registerTool(
    'search',
    {
      description: 'Full-text fuzzy search across all content items',
      inputSchema: {
        query: z.string().describe('Search query'),
        category: z
          .string()
          .optional()
          .describe('Restrict search to a category (rules, skills, workflows, agents)'),
        limit: z.number().min(1).max(50).optional().default(20).describe('Maximum results'),
        projectDir: z
          .string()
          .optional()
          .describe(
            'Project directory used to detect the stack and annotate results with applicability (applies-to).'
          ),
      },
    },
    async ({
      query,
      category,
      limit,
      projectDir,
    }: {
      query: string
      category?: string
      limit?: number
      projectDir?: string
    }) => {
      logger.trace({ query, category, limit, projectDir }, 'search called')
      engine.buildIndex(store.getAll())
      const results = engine.search({ query, category, limit })
      const stacks = projectDir ? detectStacks(resolve(projectDir)) : []

      const items = results
        .map(r => {
          const appliesTo = r.item.appliesTo ?? []
          return {
            score: r.score,
            path: r.item.path,
            category: r.item.category,
            name: r.item.name,
            title: r.item.title,
            description: r.item.description,
            tags: r.item.tags,
            version: r.item.version,
            compatibility: r.item.compatibility,
            appliesTo,
            applicable:
              appliesTo.length === 0 ||
              stacks.length === 0 ||
              appliesTo.some(stack => stacks.includes(stack)),
          }
        })
        .sort((a, b) => {
          if (a.applicable !== b.applicable) return a.applicable ? -1 : 1
          return b.score - a.score
        })

      const payload = projectDir ? { projectStacks: stacks, items } : items
      return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
    }
  )
}
