import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'

export const registerResources = (server: McpServer, store: ContentStore): void => {
  const categories = ['rules', 'skills', 'workflows', 'agents', 'commands', 'templates'] as const

  logger.trace({ categories }, 'registering resource templates')

  for (const cat of categories) {
    const uri = `aik://${cat}`

    server.registerResource(`${cat}-list`, uri, {}, async (resourceUri: URL) => {
      logger.trace({ category: cat }, 'resource: listing category')
      const catItems = store.getByCategory(cat)
      const listing = catItems.map(i => ({
        path: i.path,
        name: i.name,
        title: i.title,
        description: i.description,
        tags: i.tags,
        version: i.version,
      }))
      return {
        contents: [
          {
            uri: resourceUri.href,
            text: JSON.stringify(listing, null, 2),
            mimeType: 'application/json',
          },
        ],
      }
    })
  }

  server.registerResource('search', 'aik://search', {}, async (resourceUri: URL) => {
    const query = resourceUri.searchParams?.get('q') ?? ''
    const items = store.getAll()
    const filtered = query
      ? items.filter(
          i =>
            i.title.toLowerCase().includes(query.toLowerCase()) ||
            i.description.toLowerCase().includes(query.toLowerCase()) ||
            i.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
        )
      : items

    return {
      contents: [
        {
          uri: resourceUri.href,
          text: JSON.stringify(
            filtered.map(i => ({ path: i.path, category: i.category, title: i.title })),
            null,
            2
          ),
          mimeType: 'application/json',
        },
      ],
    }
  })
}
