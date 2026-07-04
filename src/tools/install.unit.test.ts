import { resolve } from 'node:path'
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

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  appendFileSync: mockAppendFileSync,
}))

vi.mock('../logger.js', () => ({
  logger: { trace: vi.fn() },
}))

vi.mock('./shared.js', () => ({
  detectAgent: vi.fn<(dir: string, preferred?: string) => string>(),
  findExistingConfig: vi.fn<(dir: string) => { path: string; agent: string } | null>(),
  AGENTS: ['opencode', 'claude-code', 'cline'],
}))

vi.mock('./uninstall.js', () => ({
  uninstallOpenCode: vi.fn<(configPath: string, targetDir: string, itemPath: string) => boolean>(),
  uninstallClaudeCode: vi.fn<(configPath: string, itemPath: string) => boolean>(),
  uninstallCline: vi.fn<(configPath: string, itemPath: string) => boolean>(),
}))

const {
  openCodeConfigPath,
  installOpenCode,
  installClaudeCode,
  installCline,
  registerInstallTool,
  registerReinstallTool,
} = await import('./install.js')

const mockDetectAgent = (await import('./shared.js')).detectAgent as Mock
const mockFindExistingConfig = (await import('./shared.js')).findExistingConfig as Mock
const mockUninstallOpenCode = (await import('./uninstall.js')).uninstallOpenCode as Mock
const mockUninstallClaudeCode = (await import('./uninstall.js')).uninstallClaudeCode as Mock
const mockUninstallCline = (await import('./uninstall.js')).uninstallCline as Mock

beforeEach(() => {
  mockExistsSync.mockReset()
  mockReadFileSync.mockReset()
  mockWriteFileSync.mockReset()
  mockMkdirSync.mockReset()
  mockAppendFileSync.mockReset()
  mockDetectAgent.mockReset()
  mockFindExistingConfig.mockReset()
  mockUninstallOpenCode.mockReset()
  mockUninstallClaudeCode.mockReset()
  mockUninstallCline.mockReset()
})

describe('openCodeConfigPath', () => {
  test('should return existing path when provided', () => {
    expect(openCodeConfigPath('/custom', '/existing/path.jsonc')).toBe('/existing/path.jsonc')
  })

  test('should default to .opencode/opencode.jsonc when no existing path', () => {
    const result = openCodeConfigPath('/project', null)
    expect(result).toBe(resolve('/project', '.opencode', 'opencode.jsonc'))
  })
})

describe('installOpenCode', () => {
  test('should install new content to correct directory', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({}))
    mockExistsSync.mockReturnValue(false)

    const result = installOpenCode(
      '/project/opencode.jsonc',
      '/project',
      'rules',
      'my-rule',
      '# My Rule'
    )

    expect(mockMkdirSync).toHaveBeenCalledWith(resolve('/project', '.opencode', 'rules'), {
      recursive: true,
    })
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      resolve('/project', '.opencode', 'rules', 'my-rule.md'),
      '# My Rule',
      'utf-8'
    )
    expect(mockReadFileSync).toHaveBeenCalledWith('/project/opencode.jsonc', 'utf-8')
    expect(result.alreadyInstalled).toBe(false)
    expect(result.path).toBe('/project/opencode.jsonc')
  })

  test('should detect already installed content', () => {
    const config = { instructions: ['.opencode/rules/my-rule.md'] }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))
    mockExistsSync.mockReturnValue(false)

    const result = installOpenCode(
      '/project/opencode.jsonc',
      '/project',
      'rules',
      'my-rule',
      '# My Rule'
    )

    expect(result.alreadyInstalled).toBe(true)
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1) // only the content file, not the config
  })

  test('should create config when no existing config path', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    mockExistsSync.mockReturnValue(false)

    const result = installOpenCode(null, '/project', 'rules', 'my-rule', '# My Rule')

    expect(mockWriteFileSync).toHaveBeenCalledTimes(2)
    expect(mockWriteFileSync).toHaveBeenLastCalledWith(
      resolve('/project', '.opencode', 'opencode.jsonc'),
      expect.stringContaining('.opencode/rules/my-rule.md'),
      'utf-8'
    )
    expect(result.alreadyInstalled).toBe(false)
  })
})

describe('installClaudeCode', () => {
  test('should append section to new CLAUDE.md', () => {
    mockExistsSync.mockReturnValue(false)

    const result = installClaudeCode(null, '/project', 'rules/my-rule', 'My Rule', '# Content')

    expect(mockAppendFileSync).toHaveBeenCalledWith(
      resolve('/project', 'CLAUDE.md'),
      expect.stringContaining('rules/my-rule'),
      'utf-8'
    )
    expect(result.alreadyInstalled).toBe(false)
  })

  test('should detect already installed source tag', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('<source>rules/my-rule</source>')

    const result = installClaudeCode(
      '/custom/CLAUDE.md',
      '/project',
      'rules/my-rule',
      'My Rule',
      '# Content'
    )

    expect(mockAppendFileSync).not.toHaveBeenCalled()
    expect(result.alreadyInstalled).toBe(true)
  })

  test('should append to existing file without duplicate', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('## Other\ncontent')

    const result = installClaudeCode(
      '/project/CLAUDE.md',
      '/project',
      'rules/my-rule',
      'My Rule',
      '# Content'
    )

    expect(mockAppendFileSync).toHaveBeenCalled()
    expect(result.alreadyInstalled).toBe(false)
  })
})

describe('installCline', () => {
  test('should append entry to new .clinerules', () => {
    mockExistsSync.mockReturnValue(false)

    const result = installCline(null, '/project', 'rules/my-rule', '# Content')

    expect(mockAppendFileSync).toHaveBeenCalledWith(
      resolve('/project', '.clinerules'),
      expect.stringContaining('rules/my-rule'),
      'utf-8'
    )
    expect(result.alreadyInstalled).toBe(false)
  })

  test('should detect already installed marker', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('<!-- from rules/my-rule -->')

    const result = installCline('/custom/.clinerules', '/project', 'rules/my-rule', '# Content')

    expect(mockAppendFileSync).not.toHaveBeenCalled()
    expect(result.alreadyInstalled).toBe(true)
  })

  test('should append to existing file without duplicate', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('other content')

    const result = installCline('/project/.clinerules', '/project', 'rules/my-rule', '# Content')

    expect(mockAppendFileSync).toHaveBeenCalled()
    expect(result.alreadyInstalled).toBe(false)
  })
})

function createMockStore(): ContentStore {
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
  } as unknown as ContentStore
}

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

describe('registerInstallTool', () => {
  test('should return error when content not found', async () => {
    const store = {
      getByPath: vi.fn<() => null>().mockReturnValue(null),
    } as unknown as ContentStore
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
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({ path: '/project/opencode.jsonc', agent: 'opencode' })
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes('opencode.jsonc') ? JSON.stringify({}) : '# My Rule\ncontent'
    )
    mockExistsSync.mockReturnValue(false)

    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.installed).toBe('rules/test-rule')
    expect(parsed.agent).toBe('opencode')
  })

  test('should install with claude-code agent', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockDetectAgent.mockReturnValue('claude-code')
    mockFindExistingConfig.mockReturnValue({ path: '/project/CLAUDE.md', agent: 'claude-code' })
    mockReadFileSync.mockReturnValue('# My Rule\ncontent')
    mockExistsSync.mockReturnValue(false)

    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.installed).toBe('rules/test-rule')
    expect(parsed.agent).toBe('claude-code')
  })

  test('should install with cline agent when no existing config', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockDetectAgent.mockReturnValue('cline')
    mockFindExistingConfig.mockReturnValue(null)
    mockReadFileSync.mockReturnValue('# My Rule\ncontent')
    mockExistsSync.mockReturnValue(false)

    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.installed).toBe('rules/test-rule')
    expect(parsed.agent).toBe('cline')
  })

  test('should return already-installed message', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({ path: '/project/opencode.jsonc', agent: 'opencode' })
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes('opencode.jsonc')
        ? JSON.stringify({ instructions: ['.opencode/rules/test-rule.md'] })
        : '# My Rule\ncontent'
    )
    mockExistsSync.mockReturnValue(false)

    registerInstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
    })) as ToolContent
    expect(result.content[0].text).toContain('Already installed')
  })
})

describe('registerReinstallTool', () => {
  test('should return error when content not found', async () => {
    const store = {
      getByPath: vi.fn<() => null>().mockReturnValue(null),
    } as unknown as ContentStore
    const { server, getHandler } = createMockServer()
    registerReinstallTool(server, store)
    const handler = getHandler()

    const result = (await handler({ path: 'rules/nonexistent' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Content not found')
  })

  test('should reinstall with opencode agent', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({ path: '/project/opencode.jsonc', agent: 'opencode' })
    mockUninstallOpenCode.mockReturnValue(true)
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes('opencode.jsonc') ? JSON.stringify({}) : '# My Rule\ncontent'
    )

    registerReinstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.reinstalled).toBe('rules/test-rule')
    expect(parsed.agent).toBe('opencode')
    expect(parsed.hadPreviousInstall).toBe(true)
    expect(mockUninstallOpenCode).toHaveBeenCalled()
  })

  test('should reinstall with claude-code agent', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockDetectAgent.mockReturnValue('claude-code')
    mockFindExistingConfig.mockReturnValue({ path: '/project/CLAUDE.md', agent: 'claude-code' })
    mockUninstallClaudeCode.mockReturnValue(false)
    mockReadFileSync.mockReturnValue('# My Rule\ncontent')
    mockExistsSync.mockReturnValue(true)

    registerReinstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.reinstalled).toBe('rules/test-rule')
    expect(parsed.agent).toBe('claude-code')
    expect(parsed.hadPreviousInstall).toBe(false)
    expect(mockUninstallClaudeCode).toHaveBeenCalled()
  })

  test('should reinstall with cline agent', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockDetectAgent.mockReturnValue('cline')
    mockFindExistingConfig.mockReturnValue({ path: '/project/.clinerules', agent: 'cline' })
    mockUninstallCline.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('# My Rule\ncontent')
    mockExistsSync.mockReturnValue(false)

    registerReinstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.reinstalled).toBe('rules/test-rule')
    expect(parsed.agent).toBe('cline')
    expect(mockUninstallCline).toHaveBeenCalled()
  })

  test('should return error when no config found', async () => {
    const store = createMockStore()
    const { server, getHandler } = createMockServer()
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue(null)

    registerReinstallTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      path: 'rules/test-rule',
      projectDir: '/project',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })
})
