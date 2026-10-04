import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { beforeEach, describe, expect, type Mock, test } from 'vitest'
import type { ContentStore } from '../content-store.js'

type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

const mockExistsSync = vi.fn<(path: string) => boolean>()
const mockReadFileSync = vi.fn<(path: string, encoding?: string) => string>()
const mockWriteFileSync = vi.fn<(path: string, data: string, encoding?: string) => void>()
const mockMkdirSync = vi.fn<(path: string, opts?: { recursive?: boolean }) => void>()
const mockAppendFileSync = vi.fn<(path: string, data: string, encoding?: string) => void>()
const mockCpSync = vi.fn<(src: string, dest: string, opts?: { recursive?: boolean }) => void>()
const mockReaddirSync =
  vi.fn<
    (
      path: string,
      opts?: { withFileTypes?: boolean }
    ) => Array<{ name: string; isDirectory: () => boolean }>
  >()
const mockUnlinkSync = vi.fn<(path: string) => void>()
const mockRmSync = vi.fn<(path: string, opts?: { recursive?: boolean; force?: boolean }) => void>()

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  appendFileSync: mockAppendFileSync,
  cpSync: mockCpSync,
  readdirSync: mockReaddirSync,
  unlinkSync: mockUnlinkSync,
  rmSync: mockRmSync,
}))

vi.mock('node:os', () => ({
  homedir: () => '/home/user',
}))

vi.mock('../logger.js', () => ({
  logger: { trace: vi.fn() },
}))

vi.mock('./agents/detection.js', () => ({
  findAgentConfig: vi.fn<(dir: string) => { path: string; agent: string } | null>(),
}))

const { registerInstallTool, registerReinstallTool } = await import('./install.js')

const mockFindExistingConfig = (await import('./agents/detection.js')).findAgentConfig as Mock

beforeEach(() => {
  mockExistsSync.mockReset()
  mockReadFileSync.mockReset()
  mockWriteFileSync.mockReset()
  mockMkdirSync.mockReset()
  mockAppendFileSync.mockReset()
  mockCpSync.mockReset()
  mockReaddirSync.mockReset()
  mockUnlinkSync.mockReset()
  mockRmSync.mockReset()
  mockFindExistingConfig.mockReset()
})

const createMockStore = (): ContentStore => {
  const item = {
    path: 'rules/test-rule',
    category: 'rules',
    name: 'test-rule',
    title: 'Test Rule',
    description: 'A test rule',
    tags: ['test'],
    version: '1.0.0',
    compatibility: ['opencode', 'claude-code', 'cline'],
    author: undefined,
    created: undefined,
    updated: undefined,
    content: '# Test\ncontent',
    fullPath: '/store/rules/test-rule.md',
  }
  return {
    getByPath: vi.fn<() => typeof item | null>().mockReturnValue(item),
    readContent: vi.fn(() => '# My Rule\ncontent'),
  } as unknown as ContentStore // Safe: test mock type limitation
}

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

describe('registerInstallTool', () => {
  test('should return error when content not found', async () => {
    const store = {
      getByPath: vi.fn<() => null>().mockReturnValue(null),
    } as unknown as ContentStore // Safe: test mock type limitation
    const { server, getHandler } = createMockServer()
    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({ path: 'rules/nonexistent' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Content not found')
  })

  test('should install with opencode agent', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes('opencode.jsonc') ? JSON.stringify({}) : '# My Rule\ncontent'
    )
    mockExistsSync.mockReturnValue(false)

    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.installed).toBe('rules/test-rule')
    expect(parsed.agent).toBe('opencode')
  })

  test('should install with claude-code agent', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockFindExistingConfig.mockReturnValue({ path: '/project/CLAUDE.md', agent: 'claude-code' })
    mockReadFileSync.mockReturnValue('# My Rule\ncontent')
    mockExistsSync.mockReturnValue(false)

    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
      agent: 'claude-code',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.installed).toBe('rules/test-rule')
    expect(parsed.agent).toBe('claude-code')
  })

  test('should install with cline agent when no existing config', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockFindExistingConfig.mockReturnValue(null)
    mockReadFileSync.mockReturnValue('# My Rule\ncontent')
    mockExistsSync.mockReturnValue(false)

    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
      agent: 'cline',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.installed).toBe('rules/test-rule')
    expect(parsed.agent).toBe('cline')
  })

  test('should return already-installed message', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes('opencode.jsonc')
        ? JSON.stringify({ instructions: ['.opencode/rules/test-rule.md'] })
        : '# My Rule\ncontent'
    )
    mockExistsSync.mockReturnValue(true)

    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolContent
    expect(result.content[0].text).toContain('Already installed')
  })
})

describe('registerReinstallTool', () => {
  test('should return error when content not found', async () => {
    const store = {
      getByPath: vi.fn<() => null>().mockReturnValue(null),
    } as unknown as ContentStore // Safe: test mock type limitation
    const { server, getHandler } = createMockServer()
    registerReinstallTool(server, store)
    const handler = getHandler()

    const result = (await handler({ path: 'rules/nonexistent', agent: 'opencode' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Content not found')
  })

  test('should reinstall with opencode agent', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes('opencode.jsonc')
        ? JSON.stringify({ instructions: ['.opencode/rules/test-rule.md'] })
        : '# My Rule\ncontent'
    )
    mockExistsSync.mockReturnValue(true)

    registerReinstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.reinstalled).toBe('rules/test-rule')
    expect(parsed.agent).toBe('opencode')
    expect(parsed.hadPreviousInstall).toBe(true)
  })

  test('should return error when no config found', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockFindExistingConfig.mockReturnValue(null)

    registerReinstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })
})

describe('registerInstallTool - global scope', () => {
  test('should install globally with opencode agent', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockReadFileSync.mockReturnValue('# My Rule\ncontent')
    mockExistsSync.mockReturnValue(false)

    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      agent: 'opencode',
      scope: 'global',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.installed).toBe('rules/test-rule')
    expect(parsed.agent).toBe('opencode')
    expect(parsed.scope).toBe('global')
  })

  test('should return error for copilot global install', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()

    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      agent: 'copilot',
      scope: 'global',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Global scope is not supported for copilot')
  })
})

describe('registerReinstallTool - global scope', () => {
  test('should reinstall globally with opencode agent', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ instructions: ['~/.config/opencode/rules/test-rule.md'] })
    )
    mockExistsSync.mockReturnValue(true)

    registerReinstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      agent: 'opencode',
      scope: 'global',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.reinstalled).toBe('rules/test-rule')
    expect(parsed.agent).toBe('opencode')
    expect(parsed.scope).toBe('global')
    expect(parsed.hadPreviousInstall).toBe(true)
  })

  test('should return error for copilot global reinstall', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()

    registerReinstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      agent: 'copilot',
      scope: 'global',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Global scope is not supported for copilot')
  })
})
