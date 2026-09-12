import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { frontmatterSchema, validateFrontmatter } from '../frontmatter.js'
import { logger } from '../logger.js'

export const registerWriteTool = (server: McpServer, store: ContentStore): void => {
  server.registerTool(
    'write',
    {
      description: 'Create or update a content item (rules, skills, workflows, agents)',
      inputSchema: {
        path: z
          .string()
          .describe(
            'Path for the content (e.g. "rules/coding-standards"). Category is derived from the first path segment.'
          ),
        content: z.string().describe('Markdown body content (without frontmatter)'),
        title: z.string().optional().describe('Title (frontmatter)'),
        description: z.string().optional().describe('Short description (frontmatter)'),
        tags: z.array(z.string()).optional().describe('Tags (frontmatter)'),
        version: z
          .string()
          .regex(/^\d+\.\d+\.\d+$/, 'version must be in semver format (e.g. 1.0.0)')
          .optional()
          .describe('Semver version (frontmatter). Defaults to 1.0.0'),
        compatibility: z
          .array(z.string())
          .optional()
          .describe(
            'Compatible AI agents (frontmatter). Defaults to ["opencode", "claude-code", "cline"]'
          ),
        overwrite: z
          .boolean()
          .optional()
          .default(false)
          .describe('Set to true to overwrite an existing file'),
      },
    },
    async ({
      path,
      content,
      title,
      description,
      tags,
      version,
      compatibility,
      overwrite,
    }: {
      path: string
      content: string
      title?: string
      description?: string
      tags?: string[]
      version?: string
      compatibility?: string[]
      overwrite?: boolean
    }) => {
      const frontmatter = frontmatterSchema.parse({
        title,
        description,
        tags,
        version,
        compatibility,
      })
      const validation = validateFrontmatter(frontmatter)
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
        logger.error({ err, path }, 'write tool error')
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        }
      }
    }
  )
}
