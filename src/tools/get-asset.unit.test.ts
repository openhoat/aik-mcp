import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, test } from 'vitest'
import type { ContentStore } from '../content-store.js'

type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

vi.mock('../logger.js', () => ({
  logger: { trace: vi.fn(), error: vi.fn() },
}))

const { registerGetAssetTool } = await import('./get-asset.js')

const createMockStore = (item: unknown, assetContent: string | null = null): ContentStore =>
  ({
    getByPath: vi.fn().mockReturnValue(item),
    readAsset: vi.fn().mockReturnValue(assetContent),
  }) as unknown as ContentStore // Safe: test mock type limitation

const createMockServer = () => {
  let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  const server = {
    registerTool: (
      _name: string,
      _config: Record<string, unknown>,
      cb: ((args: Record<string, unknown>) => Promise<unknown>) | null
    ) => {
      handler = cb
      return server
    },
  } as unknown as McpServer // Safe: test mock type limitation
  return { server, getHandler: () => handler! }
}

const item = {
  path: 'skills/generate-changelog',
  fullPath: '/store/skills/generate-changelog/README.md',
  category: 'skills',
  name: 'generate-changelog',
  title: 'Generate Changelog',
  description: 'Regenerate CHANGELOG.md',
  tags: ['changelog'],
  version: '1.0.0',
  compatibility: ['opencode', 'claude-code', 'cline'],
  content: '# Generate Changelog',
  assets: ['scripts/changelog.mjs', 'examples/example.md'],
}

describe('registerGetAssetTool', () => {
  test('should return error when content not found', async () => {
    const { server, getHandler } = createMockServer()
    registerGetAssetTool(server, createMockStore(null))
    const result = (await getHandler()({
      path: 'skills/nonexistent',
      asset: 'foo.mjs',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Content not found')
  })

  test('should return error when asset not in bundle', async () => {
    const { server, getHandler } = createMockServer()
    registerGetAssetTool(server, createMockStore(item))
    const result = (await getHandler()({
      path: 'skills/generate-changelog',
      asset: 'missing.mjs',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Asset not found')
  })

  test('should read an asset from the bundle', async () => {
    const { server, getHandler } = createMockServer()
    registerGetAssetTool(server, createMockStore(item, 'import x from "y"\n'))

    const result = (await getHandler()({
      path: 'skills/generate-changelog',
      asset: 'scripts/changelog.mjs',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.path).toBe('skills/generate-changelog')
    expect(parsed.asset).toBe('scripts/changelog.mjs')
    expect(parsed.content).toContain('import x')
  })

  test('should return error when the asset cannot be read', async () => {
    const { server, getHandler } = createMockServer()
    registerGetAssetTool(server, createMockStore(item, null))

    const result = (await getHandler()({
      path: 'skills/generate-changelog',
      asset: 'scripts/changelog.mjs',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Failed to read asset')
  })
})
