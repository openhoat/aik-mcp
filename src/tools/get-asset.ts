import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'

export const registerGetAssetTool = (server: McpServer, store: ContentStore): void => {
  server.registerTool(
    'get_asset',
    {
      description:
        'Read a supporting asset file bundled with a content item (e.g. an example, script, or template referenced by its README).',
      inputSchema: {
        path: z.string().describe('Path of the content item (e.g. "skills/generate-changelog")'),
        asset: z
          .string()
          .describe('Relative asset path within the bundle (e.g. "scripts/changelog.mjs")'),
      },
    },
    async ({ path, asset }: { path: string; asset: string }) => {
      logger.trace({ path, asset }, 'get_asset called')
      const item = store.getByPath(path)
      if (!item) {
        return { content: [{ type: 'text', text: `Content not found: ${path}` }], isError: true }
      }
      if (!item.assets.includes(asset)) {
        return {
          content: [
            {
              type: 'text',
              text: `Asset not found: ${asset}. Available assets: ${item.assets.join(', ') || '(none)'}`,
            },
          ],
          isError: true,
        }
      }

      const assetPath = join(item.fullPath, '..', asset)
      try {
        const content = readFileSync(assetPath, 'utf-8')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ path, asset, content }, null, 2),
            },
          ],
        }
      } catch (err) {
        logger.error({ err, path, asset }, 'get_asset read error')
        return {
          content: [{ type: 'text', text: `Failed to read asset: ${asset}` }],
          isError: true,
        }
      }
    }
  )
}
