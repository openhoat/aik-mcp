import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { beforeEach, describe, expect, type Mock, test } from 'vitest'
import type { ContentStore } from '../content-store.js'

type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

const mockReadFileSync = vi.fn<(path: string, encoding?: string) => string>()
const mockExistsSync = vi.fn<(path: string) => boolean>()
const mockWriteFileSync = vi.fn<(path: string, data: string, encoding?: string) => void>()
const mockUnlinkSync = vi.fn<(path: string) => void>()

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  writeFileSync: mockWriteFileSync,
  unlinkSync: mockUnlinkSync,
}))

vi.mock('../logger.js', () => ({
  logger: { trace: vi.fn() },
}))

vi.mock('./shared.js', () => ({
  detectAgent: vi.fn<(dir: string, preferred?: string) => string>(),
  findExistingConfig: vi.fn<(dir: string) => { path: string; agent: string } | null>(),
  AGENTS: ['opencode', 'claude-code', 'cline'],
}))

vi.mock('./install.js', () => ({
  installOpenCode: vi.fn<(path: string | null, dir: string, ...args: unknown[]) => void>(),
  installClaudeCode: vi.fn<(path: string | null, dir: string, ...args: unknown[]) => void>(),
  installCline: vi.fn<(path: string | null, dir: string, ...args: unknown[]) => void>(),
}))

vi.mock('./uninstall.js', () => ({
  uninstallOpenCode: vi.fn<(path: string, dir: string, item: string) => boolean>(),
  uninstallClaudeCode: vi.fn<(path: string, item: string) => boolean>(),
  uninstallCline: vi.fn<(path: string, item: string) => boolean>(),
}))

vi.mock('../frontmatter.js', () => ({
  parseFrontmatter: vi.fn((_content: string) => ({
    frontmatter: { version: '1.0.0' },
  })),
}))

const {
  parseSemver,
  isNewer,
  getInstalledVersionOpenCode,
  getInstalledVersionClaudeCode,
  getInstalledVersionCline,
  getInstalledVersion,
  listInstalledOpenCode,
  listInstalledClaudeCode,
  listInstalledCline,
  registerCheckUpdatesTool,
  registerUpdateTool,
} = await import('./update.js')

const mockDetectAgent = (await import('./shared.js')).detectAgent as Mock
const mockFindExistingConfig = (await import('./shared.js')).findExistingConfig as Mock
const mockInstallOpenCode = (await import('./install.js')).installOpenCode as Mock
const mockInstallClaudeCode = (await import('./install.js')).installClaudeCode as Mock
const mockInstallCline = (await import('./install.js')).installCline as Mock
const mockUninstallOpenCode = (await import('./uninstall.js')).uninstallOpenCode as Mock
const mockUninstallClaudeCode = (await import('./uninstall.js')).uninstallClaudeCode as Mock
const mockUninstallCline = (await import('./uninstall.js')).uninstallCline as Mock
const mockParseFrontmatter = (await import('../frontmatter.js')).parseFrontmatter as Mock

beforeEach(() => {
  mockReadFileSync.mockReset()
  mockExistsSync.mockReset()
  mockWriteFileSync.mockReset()
  mockUnlinkSync.mockReset()
  mockDetectAgent.mockReset()
  mockFindExistingConfig.mockReset()
  mockInstallOpenCode.mockReset()
  mockInstallClaudeCode.mockReset()
  mockInstallCline.mockReset()
  mockUninstallOpenCode.mockReset()
  mockUninstallClaudeCode.mockReset()
  mockUninstallCline.mockReset()
  mockParseFrontmatter.mockReset()
  mockParseFrontmatter.mockReturnValue({ frontmatter: { version: '1.0.0' } })
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

describe('getInstalledVersionOpenCode', () => {
  test('should return version from file', () => {
    mockExistsSync.mockReturnValue(true)
    mockParseFrontmatter.mockReturnValue({ frontmatter: { version: '1.5.0' } })
    mockReadFileSync.mockReturnValue('content')

    const result = getInstalledVersionOpenCode('/project', 'rules/ts')

    expect(result).toBe('1.5.0')
  })

  test('should return null when file does not exist', () => {
    mockExistsSync.mockReturnValue(false)

    const result = getInstalledVersionOpenCode('/project', 'rules/ts')

    expect(result).toBeNull()
  })

  test('should return null when version not in frontmatter', () => {
    mockExistsSync.mockReturnValue(true)
    mockParseFrontmatter.mockReturnValue({ frontmatter: {} })

    const result = getInstalledVersionOpenCode('/project', 'rules/ts')

    expect(result).toBeNull()
  })

  test('should return null on read error', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation(() => {
      throw new Error('read error')
    })

    const result = getInstalledVersionOpenCode('/project', 'rules/ts')

    expect(result).toBeNull()
  })
})

describe('getInstalledVersionClaudeCode', () => {
  test('should extract version from section', () => {
    const content = [
      '# Config',
      '',
      '## TypeScript',
      '',
      '---',
      'version: "2.0.0"',
      '---',
      '',
      '<source>rules/typescript</source>',
      '',
      '## Other',
      '',
      'stuff',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)
    mockParseFrontmatter.mockReturnValue({ frontmatter: { version: '2.0.0' } })

    const result = getInstalledVersionClaudeCode('/project/CLAUDE.md', 'rules/typescript')

    expect(result).toBe('2.0.0')
  })

  test('should return null when source tag not found', () => {
    mockReadFileSync.mockReturnValue('# Config\n\n')

    const result = getInstalledVersionClaudeCode('/project/CLAUDE.md', 'rules/typescript')

    expect(result).toBeNull()
  })

  test('should return null when section start not found', () => {
    mockReadFileSync.mockReturnValue('<source>rules/typescript</source>\n')

    const result = getInstalledVersionClaudeCode('/project/CLAUDE.md', 'rules/typescript')

    expect(result).toBeNull()
  })

  test('should return null on parse error', () => {
    mockReadFileSync.mockReturnValue('## TS\n\n<source>rules/ts</source>\n')
    mockParseFrontmatter.mockImplementation(() => {
      throw new Error('parse error')
    })

    const result = getInstalledVersionClaudeCode('/project/CLAUDE.md', 'rules/ts')

    expect(result).toBeNull()
  })
})

describe('getInstalledVersionCline', () => {
  test('should extract version from marked section', () => {
    const content = [
      '# Config',
      '',
      '<!-- from rules/typescript -->',
      '',
      '---',
      'version: "3.0.0"',
      '---',
      '',
      'content',
      '',
      '<!-- from rules/other -->',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)
    mockParseFrontmatter.mockReturnValue({ frontmatter: { version: '3.0.0' } })

    const result = getInstalledVersionCline('/project/.clinerules', 'rules/typescript')

    expect(result).toBe('3.0.0')
  })

  test('should return null when marker not found', () => {
    mockReadFileSync.mockReturnValue('# Config\n\n')

    const result = getInstalledVersionCline('/project/.clinerules', 'rules/typescript')

    expect(result).toBeNull()
  })

  test('should return null on parse error', () => {
    mockReadFileSync.mockReturnValue('<!-- from rules/ts -->\n')
    mockParseFrontmatter.mockImplementation(() => {
      throw new Error('parse error')
    })

    const result = getInstalledVersionCline('/project/.clinerules', 'rules/ts')

    expect(result).toBeNull()
  })
})

describe('getInstalledVersion', () => {
  test('should call OpenCode getter for opencode agent', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('---\nversion: "1.0.0"\n---')

    const result = getInstalledVersion('/project', 'rules/ts', 'opencode', '/config')

    expect(result).toBe('1.0.0')
  })

  test('should call ClaudeCode getter for claude-code agent', () => {
    const content = [
      '',
      '## TS',
      '',
      '---',
      'version: "1.0.0"',
      '---',
      '',
      '<source>rules/ts</source>',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)
    mockParseFrontmatter.mockReturnValue({ frontmatter: { version: '1.0.0' } })

    const result = getInstalledVersion('/project', 'rules/ts', 'claude-code', '/config')

    expect(result).toBe('1.0.0')
  })

  test('should call Cline getter for cline agent', () => {
    const content = ['<!-- from rules/ts -->', '', '---', 'version: "1.0.0"', '---', ''].join('\n')
    mockReadFileSync.mockReturnValue(content)
    mockParseFrontmatter.mockReturnValue({ frontmatter: { version: '1.0.0' } })

    const result = getInstalledVersion('/project', 'rules/ts', 'cline', '/config')

    expect(result).toBe('1.0.0')
  })
})

describe('listInstalledOpenCode', () => {
  test('should return installed paths', () => {
    const config = {
      instructions: ['.opencode/rules/ts.md', '.opencode/skills/test.md'],
    }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))

    const result = listInstalledOpenCode('/project/opencode.jsonc')

    expect(result).toEqual(['rules/ts', 'skills/test'])
  })

  test('should return empty when no instructions', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({}))

    const result = listInstalledOpenCode('/project/opencode.jsonc')

    expect(result).toEqual([])
  })
})

describe('listInstalledClaudeCode', () => {
  test('should extract paths from source tags', () => {
    const content = [
      '# Config',
      '',
      '## TS',
      '',
      '<source>rules/ts</source>',
      '',
      '## Test',
      '',
      '<source>rules/test</source>',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)

    const result = listInstalledClaudeCode('/project/CLAUDE.md')

    expect(result).toEqual(['rules/ts', 'rules/test'])
  })

  test('should return empty when no source tags', () => {
    mockReadFileSync.mockReturnValue('# Config\n\n')

    const result = listInstalledClaudeCode('/project/CLAUDE.md')

    expect(result).toEqual([])
  })
})

describe('listInstalledCline', () => {
  test('should extract paths from markers', () => {
    const content = [
      '# Config',
      '',
      '<!-- from rules/ts -->',
      '',
      '<!-- from skills/test -->',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)

    const result = listInstalledCline('/project/.clinerules')

    expect(result).toEqual(['rules/ts', 'skills/test'])
  })

  test('should return empty when no markers', () => {
    mockReadFileSync.mockReturnValue('# Config\n\n')

    const result = listInstalledCline('/project/.clinerules')

    expect(result).toEqual([])
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
  test('should return updates for opencode', async () => {
    const { server, getCheckHandler } = createMockServer()
    const store = {
      getByPath: vi.fn((path: string) =>
        path === 'rules/ts'
          ? { version: '2.0.0', category: 'rules', name: 'ts', title: 'TS' }
          : null
      ),
    } as unknown as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation((path, encoding) => {
      if (path.endsWith('.jsonc'))
        return JSON.stringify({ instructions: ['.opencode/rules/ts.md'] })
      if (encoding === 'utf-8') return '---\nversion: "1.0.0"\n---'
      return ''
    })

    registerCheckUpdatesTool(server, store)
    const handler = getCheckHandler()
    const result = (await handler({})) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.agent).toBe('opencode')
    expect(parsed.updateCount).toBe(1)
    expect(parsed.updates[0].path).toBe('rules/ts')
    expect(parsed.updates[0].storeVersion).toBe('2.0.0')
  })

  test('should return error when no config found', async () => {
    const { server, getCheckHandler } = createMockServer()
    const store = { getByPath: vi.fn() } as unknown as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue(null)

    registerCheckUpdatesTool(server, store)
    const handler = getCheckHandler()
    const result = (await handler({})) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })

  test('should return empty when no updates available', async () => {
    const { server, getCheckHandler } = createMockServer()
    const store = {
      getByPath: vi.fn((path: string) =>
        path === 'rules/ts'
          ? { version: '1.0.0', category: 'rules', name: 'ts', title: 'TS' }
          : null
      ),
    } as unknown as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation(path => {
      if (path.endsWith('.jsonc'))
        return JSON.stringify({ instructions: ['.opencode/rules/ts.md'] })
      return '---\nversion: "1.0.0"\n---'
    })

    registerCheckUpdatesTool(server, store)
    const handler = getCheckHandler()
    const result = (await handler({})) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.updateCount).toBe(0)
  })
})

describe('registerUpdateTool', () => {
  test('should update opencode item', async () => {
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
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation((path, encoding) => {
      if (encoding === 'utf-8' && path.endsWith('.md')) return '---\nversion: "1.0.0"\n---'
      return JSON.stringify({ instructions: [] })
    })
    mockUninstallOpenCode.mockReturnValue(true)

    registerUpdateTool(server, store)
    const handler = getUpdateHandler()
    const result = (await handler({ path: 'rules/typescript' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.updated).toBe('rules/typescript')
    expect(parsed.previousVersion).toBe('1.0.0')
    expect(parsed.newVersion).toBe('2.0.0')
    expect(mockUninstallOpenCode).toHaveBeenCalled()
    expect(mockInstallOpenCode).toHaveBeenCalled()
  })

  test('should update claude-code item', async () => {
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
    mockDetectAgent.mockReturnValue('claude-code')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/CLAUDE.md',
      agent: 'claude-code',
    })
    mockReadFileSync.mockImplementation((path, encoding) => {
      if (encoding === 'utf-8' && path.endsWith('.md')) return '---\nversion: "1.0.0"\n---'
      return '## TS\n\n<source>rules/ts</source>\n'
    })
    mockUninstallClaudeCode.mockReturnValue(true)

    registerUpdateTool(server, store)
    const handler = getUpdateHandler()
    const result = (await handler({ path: 'rules/typescript' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.updated).toBe('rules/typescript')
    expect(mockUninstallClaudeCode).toHaveBeenCalled()
    expect(mockInstallClaudeCode).toHaveBeenCalled()
  })

  test('should update cline item', async () => {
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
    mockDetectAgent.mockReturnValue('cline')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.clinerules',
      agent: 'cline',
    })
    mockReadFileSync.mockImplementation((path, encoding) => {
      if (encoding === 'utf-8' && path.endsWith('.md')) return '---\nversion: "1.0.0"\n---'
      return '<!-- from rules/ts -->\n'
    })
    mockUninstallCline.mockReturnValue(true)

    registerUpdateTool(server, store)
    const handler = getUpdateHandler()
    const result = (await handler({ path: 'rules/typescript' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.updated).toBe('rules/typescript')
    expect(mockUninstallCline).toHaveBeenCalled()
    expect(mockInstallCline).toHaveBeenCalled()
  })

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
      })),
    } as unknown as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('---\nversion: "1.0.0"\n---')

    registerUpdateTool(server, store)
    const handler = getUpdateHandler()
    const result = (await handler({ path: 'rules/typescript' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.status).toBe('already-up-to-date')
    expect(mockUninstallOpenCode).not.toHaveBeenCalled()
  })

  test('should update when installed version is unknown', async () => {
    const { server, getUpdateHandler } = createMockServer()
    const store = {
      getByPath: vi.fn(() => ({
        version: '2.0.0',
        fullPath: '/store/item.md',
        path: 'rules/typescript',
        category: 'rules',
        name: 'typescript',
        title: 'TypeScript',
      })),
    } as unknown as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('---\n---')
    mockUninstallOpenCode.mockReturnValue(false)

    registerUpdateTool(server, store)
    const handler = getUpdateHandler()
    const result = (await handler({ path: 'rules/typescript' })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.updated).toBe('rules/typescript')
    expect(parsed.hadPreviousInstall).toBe(false)
  })
})
