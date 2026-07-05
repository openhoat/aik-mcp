import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { beforeEach, describe, expect, type Mock, test } from 'vitest'
import type { ContentStore } from '../content-store.js'

type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

const mockReadFileSync = vi.fn<(path: string, encoding?: string) => string>()
const mockExistsSync = vi.fn<(path: string) => boolean>()
const mockWriteFileSync = vi.fn<(path: string, data: string, encoding?: string) => void>()
const mockMkdirSync = vi.fn<(path: string, opts?: { recursive?: boolean }) => void>()
const mockAppendFileSync = vi.fn<(path: string, data: string, encoding?: string) => void>()
const mockUnlinkSync = vi.fn<(path: string) => void>()
const mockRmSync = vi.fn<(path: string, opts?: { recursive?: boolean; force?: boolean }) => void>()
const mockStatSync = vi.fn<(path: string) => { isDirectory: () => boolean }>()
const mockReaddirSync = vi.fn()

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  appendFileSync: mockAppendFileSync,
  unlinkSync: mockUnlinkSync,
  rmSync: mockRmSync,
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

vi.mock('../frontmatter.js', () => ({
  parseFrontmatter: vi.fn((_content: string) => ({
    frontmatter: { version: '1.0.0' },
  })),
  serializeFrontmatter: vi.fn((_fm: unknown) => `name: test\ndescription: test`),
}))

const { parseSemver, isNewer, registerCheckUpdatesTool, registerUpdateTool } = await import(
  './update.js'
)

const mockDetectAgent = (await import('./shared.js')).detectAgent as Mock
const mockFindExistingConfig = (await import('./shared.js')).findExistingConfig as Mock
const mockParseFrontmatter = (await import('../frontmatter.js')).parseFrontmatter as Mock

beforeEach(() => {
  mockReadFileSync.mockReset()
  mockExistsSync.mockReset()
  mockWriteFileSync.mockReset()
  mockMkdirSync.mockReset()
  mockAppendFileSync.mockReset()
  mockUnlinkSync.mockReset()
  mockRmSync.mockReset()
  mockStatSync.mockReset()
  mockReaddirSync.mockReset()
  mockDetectAgent.mockReset()
  mockFindExistingConfig.mockReset()
  mockParseFrontmatter.mockReset()
  mockParseFrontmatter.mockReturnValue({ frontmatter: { version: '1.0.0' } })
  mockStatSync.mockReturnValue({ isDirectory: () => false })
})

describe('parseSemver', () => {
  test('should parse basic version', () => {
    expect(parseSemver('1.2.3')).toEqual([1, 2, 3])
  })

  test('should handle missing parts', () => {
    expect(parseSemver('1.2')).toEqual([1, 2])
  })

  test('should handle single number', () => {
    expect(parseSemver('1')).toEqual([1])
  })

  test('should handle empty string', () => {
    expect(parseSemver('')).toEqual([0])
  })
})

describe('isNewer', () => {
  test('should return true when store is newer major', () => {
    expect(isNewer('2.0.0', '1.0.0')).toBe(true)
  })

  test('should return true when store is newer minor', () => {
    expect(isNewer('1.1.0', '1.0.0')).toBe(true)
  })

  test('should return true when store is newer patch', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true)
  })

  test('should return false when installed is newer', () => {
    expect(isNewer('1.0.0', '2.0.0')).toBe(false)
  })

  test('should return false when versions are equal', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false)
  })
})

function createMockServer() {
  let checkHandler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  let updateHandler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  const server = {
    tool: (
      name: string,
      _desc: string,
      _schema: Record<string, unknown>,
      cb: ((args: Record<string, unknown>) => Promise<unknown>) | null
    ) => {
      if (name === 'check_updates') {
        checkHandler = cb
      } else if (name === 'update') {
        updateHandler = cb
      }
      return server
    },
  } as unknown as McpServer
  return {
    server,
    getCheckHandler: () => checkHandler!,
    getUpdateHandler: () => updateHandler!,
  }
}

describe('registerCheckUpdatesTool', () => {
  test('should return error when no config found', async () => {
    const { server, getCheckHandler } = createMockServer()
    const store = { getByPath: vi.fn(), getByCategory: vi.fn(() => []) } as unknown as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue(null)

    registerCheckUpdatesTool(server, store)
    const handler = getCheckHandler()
    const result = (await handler({})) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })

  test('should return empty when no items installed', async () => {
    const { server, getCheckHandler } = createMockServer()
    const store = { getByCategory: vi.fn(() => []) } as unknown as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockExistsSync.mockReturnValue(false)

    registerCheckUpdatesTool(server, store)
    const handler = getCheckHandler()
    const result = (await handler({})) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.updateCount).toBe(0)
  })
})

describe('registerUpdateTool', () => {
  test('should return error when content not found in store', async () => {
    const { server, getUpdateHandler } = createMockServer()
    const store = { getByPath: vi.fn(() => null) } as unknown as ContentStore

    registerUpdateTool(server, store)
    const handler = getUpdateHandler()
    const result = (await handler({ path: 'rules/typescript' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Content not found')
  })

  test('should return error when no config found', async () => {
    const { server, getUpdateHandler } = createMockServer()
    const store = {
      getByPath: vi.fn(() => ({ version: '2.0.0', fullPath: '/store/item.md' })),
    } as unknown as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue(null)

    registerUpdateTool(server, store)
    const handler = getUpdateHandler()
    const result = (await handler({ path: 'rules/typescript' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })

  test('should return already-up-to-date when versions match', async () => {
    const { server, getUpdateHandler } = createMockServer()
    const store = {
      getByPath: vi.fn(() => ({
        version: '1.0.0',
        fullPath: '/store/item.md',
        path: 'rules/typescript',
        category: 'rules',
        name: 'typescript',
        title: 'TypeScript',
      })),
    } as unknown as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('---\nversion: "1.0.0"\n---')
    mockParseFrontmatter.mockReturnValue({ frontmatter: { version: '1.0.0' } })

    registerUpdateTool(server, store)
    const handler = getUpdateHandler()
    const result = (await handler({ path: 'rules/typescript' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.status).toBe('already-up-to-date')
  })

  test('should update opencode item when store version is newer', async () => {
    const { server, getUpdateHandler } = createMockServer()
    const store = {
      getByPath: vi.fn(() => ({
        version: '2.0.0',
        fullPath: '/store/rules/typescript.md',
        path: 'rules/typescript',
        category: 'rules',
        name: 'typescript',
        title: 'TypeScript',
      })),
    } as unknown as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.endsWith('.md')) return '---\nversion: "1.0.0"\n---'
      return JSON.stringify({ instructions: [] })
    })
    mockParseFrontmatter.mockReturnValue({ frontmatter: { version: '1.0.0' } })

    registerUpdateTool(server, store)
    const handler = getUpdateHandler()
    const result = (await handler({ path: 'rules/typescript' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.updated).toBe('rules/typescript')
    expect(parsed.previousVersion).toBe('1.0.0')
    expect(parsed.newVersion).toBe('2.0.0')
  })
})
