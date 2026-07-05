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
  detectAgent: vi.fn<(dir: string, preferred?: string) => string>(),
  findExistingConfig: vi.fn<(dir: string) => { path: string; agent: string } | null>(),
  AGENTS: ['opencode', 'claude-code', 'cline'],
}))

const { registerListInstalledTool } = await import('./list-installed.js')

const mockDetectAgent = (await import('./shared.js')).detectAgent as Mock
const mockFindExistingConfig = (await import('./shared.js')).findExistingConfig as Mock

beforeEach(() => {
  mockReadFileSync.mockReset()
  mockExistsSync.mockReset()
  mockStatSync.mockReset()
  mockReaddirSync.mockReset()
  mockDetectAgent.mockReset()
  mockFindExistingConfig.mockReset()
  mockStatSync.mockReturnValue({ isDirectory: () => false })
  mockExistsSync.mockReturnValue(false)
})

function createMockServer() {
  let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  const server = {
    tool: (
      _name: string,
      _desc: string,
      _schema: Record<string, unknown>,
      cb: ((args: Record<string, unknown>) => Promise<unknown>) | null
    ) => {
      handler = cb
      return server
    },
  } as unknown as McpServer
  return { server, getHandler: () => handler! }
}

describe('registerListInstalledTool', () => {
  test('should return items for opencode agent by scanning directories', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
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
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.agent).toBe('opencode')
    expect(parsed.count).toBeGreaterThanOrEqual(1)
  })

  test('should return items for claude-code agent by scanning sections', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('claude-code')
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
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.agent).toBe('claude-code')
    expect(parsed.count).toBeGreaterThanOrEqual(1)
  })

  test('should return empty message when no items', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
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
    })) as ToolContent
    expect(result.content[0].text).toContain('No aik-installed items found')
  })

  test('should return error when no config found', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue(null)

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })
})
