import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { frontmatterSchema, validateFrontmatter } from '../frontmatter.js'
import { logger } from '../logger.js'
import type { ToolRegistrar } from './shared.js'

export function registerWriteTool(server: McpServer, store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'write',
    'Create or update a content item (rules, skills, workflows, agents, commands, templates)',
    {
      path: z
        .string()
        .describe(
          'Path for the content (e.g. "rules/coding-standards"). Category is derived from the first path segment.'
        ),
      content: z.string().describe('Markdown body content (without frontmatter)'),
      title: z.string().optional().describe('Title (frontmatter)'),
      description: z.string().optional().describe('Short description (frontmatter)'),
      tags: z.array(z.string()).optional().describe('Tags (frontmatter)'),
      overwrite: z
        .boolean()
        .optional()
        .default(false)
        .describe('Set to true to overwrite an existing file'),
    },
    async ({
      path,
      content,
      title,
      description,
      tags,
      overwrite,
    }: {
      path: string
      content: string
      title?: string
      description?: string
      tags?: string[]
      overwrite?: boolean
    }) => {
      const frontmatter: Record<string, unknown> = {}
      if (title) frontmatter.title = title
      if (description) frontmatter.description = description
      if (tags) frontmatter.tags = tags

      const merged = frontmatterSchema.parse(frontmatter)
      const validation = validateFrontmatter(merged)
      if (!validation.valid) {
        return {
          content: [{ type: 'text', text: validation.errors.join('\n') }],
          isError: true,
        }
      }

      logger.trace({ path, overwrite }, 'write called')

      try {
        const item = await store.writeContent(path, content, frontmatter, overwrite ?? false)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  path: item.path,
                  title: item.title,
                  description: item.description,
                  tags: item.tags,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        }
      }
    }
  )
}
