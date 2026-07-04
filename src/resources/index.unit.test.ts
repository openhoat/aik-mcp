import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test } from 'vitest'
import type { ContentStore } from '../content-store.js'

vi.mock('../logger.js', () => ({
  logger: { trace: vi.fn() },
}))

const { registerResources } = await import('./index.js')

function createMockServer() {
  const resources: Record<string, { uri: string; cb: (uri: URL) => Promise<unknown> }> = {}
  const server = {
    resource: (name: string, uri: string, cb: (uri: URL) => Promise<unknown>) => {
      resources[name] = { uri, cb }
      return server
    },
  } as unknown as McpServer
  return { server, resources }
}

function createMockStore(
  items: Array<{
    path: string
    category: string
    name: string
    title: string
    description: string
    tags: string[]
    version: string
  }> = []
) {
  return {
    getByCategory: vi.fn((cat: string) => items.filter(i => i.category === cat)),
    getAll: vi.fn(() => items),
  } as unknown as ContentStore
}

describe('registerResources', () => {
  test('should register category list resources', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore([
      {
        path: 'rules/typescript',
        category: 'rules',
        name: 'typescript',
        title: 'TypeScript',
        description: 'TS rules',
        tags: ['ts', 'type'],
        version: '1.0.0',
      },
    ])

    registerResources(server, store)

    expect(resources['rules-list']).toBeDefined()
    expect(resources['skills-list']).toBeDefined()
    expect(resources['workflows-list']).toBeDefined()
    expect(resources['agents-list']).toBeDefined()
    expect(resources['commands-list']).toBeDefined()
    expect(resources['templates-list']).toBeDefined()
  })

  test('should register search resource', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore()

    registerResources(server, store)

    expect(resources.search).toBeDefined()
    expect(resources.search.uri).toBe('aik://search')
  })

  test('should return category listing', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore([
      {
        path: 'rules/ts',
        category: 'rules',
        name: 'ts',
        title: 'TS',
        description: 'TypeScript rules',
        tags: ['ts'],
        version: '1.0.0',
      },
      {
        path: 'skills/test',
        category: 'skills',
        name: 'test',
        title: 'Test',
        description: 'Testing skill',
        tags: ['test'],
        version: '2.0.0',
      },
    ])

    registerResources(server, store)

    const result = (await resources['rules-list'].cb(new URL('aik://rules'))) as {
      contents: Array<{ uri: string; text: string; mimeType: string }>
    }

    expect(result.contents).toHaveLength(1)
    const parsed = JSON.parse(result.contents[0].text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].path).toBe('rules/ts')
  })

  test('should return empty listing for empty category', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore()

    registerResources(server, store)

    const result = (await resources['rules-list'].cb(new URL('aik://rules'))) as {
      contents: Array<{ text: string }>
    }

    const parsed = JSON.parse(result.contents[0].text)
    expect(parsed).toHaveLength(0)
  })

  test('should search by title', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore([
      {
        path: 'rules/typescript',
        category: 'rules',
        name: 'typescript',
        title: 'TypeScript Coding Standards',
        description: 'TS rules',
        tags: ['ts'],
        version: '1.0.0',
      },
      {
        path: 'rules/testing',
        category: 'rules',
        name: 'testing',
        title: 'Testing Rules',
        description: 'Test rules',
        tags: ['test'],
        version: '1.0.0',
      },
    ])

    registerResources(server, store)

    const url = new URL('aik://search?q=typescript')
    const result = (await resources.search.cb(url)) as {
      contents: Array<{ text: string }>
    }

    const parsed = JSON.parse(result.contents[0].text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].path).toBe('rules/typescript')
  })

  test('should search by description', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore([
      {
        path: 'rules/typescript',
        category: 'rules',
        name: 'typescript',
        title: 'TS',
        description: 'TypeScript coding standards',
        tags: ['ts'],
        version: '1.0.0',
      },
      {
        path: 'rules/testing',
        category: 'rules',
        name: 'testing',
        title: 'Test',
        description: 'Testing rules',
        tags: ['test'],
        version: '1.0.0',
      },
    ])

    registerResources(server, store)

    const url = new URL('aik://search?q=coding')
    const result = (await resources.search.cb(url)) as {
      contents: Array<{ text: string }>
    }

    const parsed = JSON.parse(result.contents[0].text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].path).toBe('rules/typescript')
  })

  test('should search by tags', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore([
      {
        path: 'rules/typescript',
        category: 'rules',
        name: 'typescript',
        title: 'TS',
        description: 'TS rules',
        tags: ['typescript', 'coding'],
        version: '1.0.0',
      },
      {
        path: 'rules/testing',
        category: 'rules',
        name: 'testing',
        title: 'Test',
        description: 'Test rules',
        tags: ['test'],
        version: '1.0.0',
      },
    ])

    registerResources(server, store)

    const url = new URL('aik://search?q=coding')
    const result = (await resources.search.cb(url)) as {
      contents: Array<{ text: string }>
    }

    const parsed = JSON.parse(result.contents[0].text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].path).toBe('rules/typescript')
  })

  test('should return all items when query is empty', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore([
      {
        path: 'rules/ts',
        category: 'rules',
        name: 'ts',
        title: 'TS',
        description: 'TS rules',
        tags: ['ts'],
        version: '1.0.0',
      },
      {
        path: 'skills/test',
        category: 'skills',
        name: 'test',
        title: 'Test',
        description: 'Test skill',
        tags: ['test'],
        version: '1.0.0',
      },
    ])

    registerResources(server, store)

    const url = new URL('aik://search')
    const result = (await resources.search.cb(url)) as {
      contents: Array<{ text: string }>
    }

    const parsed = JSON.parse(result.contents[0].text)
    expect(parsed).toHaveLength(2)
  })

  test('should return all items when query is null', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore([
      {
        path: 'rules/ts',
        category: 'rules',
        name: 'ts',
        title: 'TS',
        description: 'TS rules',
        tags: ['ts'],
        version: '1.0.0',
      },
    ])

    registerResources(server, store)

    const url = new URL('aik://search')
    delete (url as unknown as Record<string, unknown>).searchParams
    const result = (await resources.search.cb(url)) as {
      contents: Array<{ text: string }>
    }

    const parsed = JSON.parse(result.contents[0].text)
    expect(parsed).toHaveLength(1)
  })

  test('should be case insensitive', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore([
      {
        path: 'rules/typescript',
        category: 'rules',
        name: 'typescript',
        title: 'TypeScript',
        description: 'TS rules',
        tags: ['ts'],
        version: '1.0.0',
      },
    ])

    registerResources(server, store)

    const url = new URL('aik://search?q=typescript')
    const result = (await resources.search.cb(url)) as {
      contents: Array<{ text: string }>
    }

    const parsed = JSON.parse(result.contents[0].text)
    expect(parsed).toHaveLength(1)

    const url2 = new URL('aik://search?q=TYPEscript')
    const result2 = (await resources.search.cb(url2)) as {
      contents: Array<{ text: string }>
    }

    const parsed2 = JSON.parse(result2.contents[0].text)
    expect(parsed2).toHaveLength(1)
  })

  test('should return json mimetype', async () => {
    const { server, resources } = createMockServer()
    const store = createMockStore()

    registerResources(server, store)

    const result = (await resources['rules-list'].cb(new URL('aik://rules'))) as {
      contents: Array<{ mimeType: string }>
    }

    expect(result.contents[0].mimeType).toBe('application/json')
  })
})
