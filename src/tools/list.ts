import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { detectStacks } from '../project-stack.js'

const VALID_CATEGORIES = ['rules', 'skills', 'workflows', 'agents']

export const registerListTool = (server: McpServer, store: ContentStore): void => {
  server.registerTool(
    'list',
    {
      description: 'List available content items (rules, skills, workflows, agents)',
      inputSchema: {
        category: z.string().optional().describe('Filter by content category'),
        tag: z.string().optional().describe('Filter by tag'),
        query: z.string().optional().describe('Filter by text query in title/description'),
        projectDir: z
          .string()
          .optional()
          .describe(
            'Project directory used to detect the stack and annotate items with applicability (applies-to).'
          ),
      },
    },
    async ({
      category,
      tag,
      query,
      projectDir,
    }: {
      category?: string
      tag?: string
      query?: string
      projectDir?: string
    }) => {
      logger.trace({ category, tag, query }, 'list called')
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

      const stacks = projectDir ? detectStacks(resolve(projectDir)) : []

      const result = items
        .map(i => {
          const appliesTo = i.appliesTo ?? []
          return {
            path: i.path,
            category: i.category,
            name: i.name,
            title: i.title,
            description: i.description,
            tags: i.tags,
            version: i.version,
            compatibility: i.compatibility,
            appliesTo,
            applicable:
              appliesTo.length === 0 ||
              stacks.length === 0 ||
              appliesTo.some(stack => stacks.includes(stack)),
          }
        })
        .sort((a, b) => {
          if (a.applicable !== b.applicable) return a.applicable ? -1 : 1
          return a.path.localeCompare(b.path)
        })

      const payload = projectDir ? { projectStacks: stacks, items: result } : result
      return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
    }
  )
}
