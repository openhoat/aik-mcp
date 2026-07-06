import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { beforeEach, describe, expect, type Mock, test } from 'vitest'
import type { ContentStore } from '../content-store.js'

type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

const mockReadFileSync = vi.fn<(path: string, encoding?: string) => string>()
const mockExistsSync = vi.fn<(path: string) => boolean>()
const mockStatSync = vi.fn<(path: string) => { isDirectory: () => boolean }>()
const mockReaddirSync =
  vi.fn<
    (
      path: string,
      opts?: { withFileTypes?: boolean }
    ) => Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>
  >()

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  statSync: mockStatSync,
  readdirSync: mockReaddirSync,
}))

vi.mock('../logger.js', () => ({
  logger: { trace: vi.fn() },
}))

vi.mock('./shared.js', () => ({
  findExistingConfig: vi.fn<(dir: string) => { path: string; agent: string } | null>(),
  AGENTS: ['opencode', 'claude-code', 'cline'],
}))

const { registerListInstalledTool } = await import('./list-installed.js')

const mockFindExistingConfig = (await import('./shared.js')).findExistingConfig as Mock

beforeEach(() => {
  mockReadFileSync.mockReset()
  mockExistsSync.mockReset()
  mockStatSync.mockReset()
  mockReaddirSync.mockReset()
  mockFindExistingConfig.mockReset()
  mockStatSync.mockReturnValue({ isDirectory: () => false })
  mockExistsSync.mockReturnValue(false)
})

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

describe('registerListInstalledTool', () => {
  test('should return items for opencode agent by scanning directories', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    // Simulate .opencode/rules/ directory with ts.md
    mockStatSync.mockImplementation((path: string) => ({
      isDirectory: () =>
        path.includes('.opencode/rules') ||
        path.includes('.opencode/agents') ||
        path.includes('.opencode/commands') ||
        path.includes('.opencode/workflows') ||
        path.includes('.opencode/templates') ||
        path.includes('.opencode/skills') ||
        path === '/project/.opencode',
    }))
    mockExistsSync.mockImplementation((path: string) => path.includes('.opencode/rules/ts.md'))
    mockReaddirSync.mockImplementation((path: string) => {
      if (path.endsWith('.opencode/rules'))
        return [{ name: 'ts.md', isDirectory: () => false, isFile: () => true }]
      return []
    })

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.agent).toBe('opencode')
    expect(parsed.count).toBeGreaterThanOrEqual(1)
  })

  test('should return items for claude-code agent by scanning sections', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/CLAUDE.md',
      agent: 'claude-code',
    })
    mockExistsSync.mockImplementation((path: string) => path.endsWith('CLAUDE.md'))
    mockReadFileSync.mockReturnValue('## TS\n\n<source>rules/ts</source>\n')

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
      agent: 'claude-code',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.agent).toBe('claude-code')
    expect(parsed.count).toBeGreaterThanOrEqual(1)
  })

  test('should return empty message when no items', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockStatSync.mockReturnValue({ isDirectory: () => false })
    mockExistsSync.mockReturnValue(false)

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolContent
    expect(result.content[0].text).toContain('No aik-installed items found')
  })

  test('should return error when no config found', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue(null)

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })

  test('should handle statSync error in isDirectory', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockStatSync.mockImplementation(() => {
      throw new Error('permission denied')
    })
    mockExistsSync.mockReturnValue(false)

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolContent
    expect(result.content[0].text).toContain('No aik-installed items found')
  })

  test('should list skills from directory-skill format', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockStatSync.mockImplementation((path: string) => ({
      isDirectory: () =>
        path.includes('.opencode/skills') ||
        path.includes('.opencode/rules') ||
        path.includes('.opencode/agents') ||
        path.includes('.opencode/commands') ||
        path.includes('.opencode/workflows') ||
        path.includes('.opencode/templates'),
    }))
    mockExistsSync.mockImplementation((path: string) => path.includes('SKILL.md'))
    mockReadFileSync.mockReturnValue('---\nname: my-skill\ndescription: A test skill\n---\nContent')
    mockReaddirSync.mockImplementation((path: string) => {
      if (path.endsWith('.opencode/skills'))
        return [{ name: 'my-skill', isDirectory: () => true, isFile: () => false }]
      return []
    })

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.count).toBeGreaterThanOrEqual(1)
    expect(parsed.items[0].title).toBe('my-skill')
  })

  test('should handle read error in skill dir gracefully', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockStatSync.mockImplementation((path: string) => ({
      isDirectory: () =>
        path.includes('.opencode/skills') ||
        path.includes('.opencode/rules') ||
        path.includes('.opencode/agents') ||
        path.includes('.opencode/commands') ||
        path.includes('.opencode/workflows') ||
        path.includes('.opencode/templates'),
    }))
    mockExistsSync.mockImplementation((path: string) => path.includes('SKILL.md'))
    mockReadFileSync.mockImplementation(() => {
      throw new Error('read error')
    })
    mockReaddirSync.mockImplementation((path: string) => {
      if (path.endsWith('.opencode/skills'))
        return [{ name: 'my-skill', isDirectory: () => true, isFile: () => false }]
      return []
    })

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.count).toBeGreaterThanOrEqual(1)
    // Title should be null since read failed
    expect(parsed.items[0].title).toBeUndefined()
  })

  test('should list claude-code items from section format', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/CLAUDE.md',
      agent: 'claude-code',
    })
    mockExistsSync.mockImplementation((path: string) => path.endsWith('CLAUDE.md'))
    mockReadFileSync.mockReturnValue(
      '## TypeScript\n\n<source>rules/ts</source>\n\n## ESLint\n\n<source>rules/eslint</source>\n'
    )

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
      agent: 'claude-code',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    // Section format is used for rules AND workflows, so each section appears twice
    expect(parsed.count).toBe(4)
    expect(parsed.items[0].title).toBe('TypeScript')
  })
})
