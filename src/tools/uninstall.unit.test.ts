import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ContentStore } from '../content-store.js'

type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

const mockReadFileSync = jest.fn<(path: string, encoding?: string) => string>()
const mockWriteFileSync = jest.fn<(path: string, data: string, encoding?: string) => void>()
const mockExistsSync = jest.fn<(path: string) => boolean>()
const mockUnlinkSync = jest.fn<(path: string) => void>()

jest.unstable_mockModule('node:fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  unlinkSync: mockUnlinkSync,
}))

jest.unstable_mockModule('../logger.js', () => ({
  logger: { trace: jest.fn() },
}))

jest.unstable_mockModule('./shared.js', () => ({
  detectAgent: jest.fn<(dir: string, preferred?: string) => string>(),
  findExistingConfig: jest.fn<(dir: string) => { path: string; agent: string } | null>(),
  AGENTS: ['opencode', 'claude-code', 'cline'],
}))

const {
  uninstallOpenCode,
  uninstallAllOpenCode,
  uninstallClaudeCode,
  uninstallAllClaudeCode,
  uninstallCline,
  uninstallAllCline,
  removeSections,
  registerUninstallTool,
} = await import('./uninstall.js')

const mockDetectAgent = (await import('./shared.js')).detectAgent as jest.Mock
const mockFindExistingConfig = (await import('./shared.js')).findExistingConfig as jest.Mock

beforeEach(() => {
  mockReadFileSync.mockReset()
  mockWriteFileSync.mockReset()
  mockExistsSync.mockReset()
  mockUnlinkSync.mockReset()
  mockDetectAgent.mockReset()
  mockFindExistingConfig.mockReset()
})

describe('removeSections', () => {
  // isTarget receives the full text from the current heading to end of content.
  const isTarget = (text: string) => {
    const firstLine = text.split('\n')[0]
    return firstLine.startsWith('## ') && firstLine.includes('test-section')
  }

  test('should return empty result for empty content', () => {
    const { result, count } = removeSections('', isTarget)
    expect(result).toBe('')
    expect(count).toBe(0)
  })

  test('should remove matching section', () => {
    const content = `# Header\n\n## test-section\nsome content\n\n## other\nkeep this`
    const { result, count } = removeSections(content, isTarget)
    expect(count).toBe(1)
    expect(result).toContain('# Header')
    expect(result).toContain('## other')
    expect(result).not.toContain('test-section')
  })

  test('should remove multiple matching sections', () => {
    const content =
      '# Header\n\n## test-section\ncontent\n\n## middle\nkeep\n\n## test-section\nmore content'
    const { result, count } = removeSections(content, isTarget)
    expect(count).toBe(2)
    expect(result).not.toContain('test-section')
    expect(result).toContain('## middle')
  })

  test('should handle sections with no following heading', () => {
    const content = `# Header\n\n## test-section\ncontent until EOF`
    const { result, count } = removeSections(content, isTarget)
    expect(count).toBe(1)
    expect(result).toBe('# Header\n')
  })

  test('should not modify content when no target found', () => {
    const content = '# Header\n\n## unrelated\nstuff'
    const { result, count } = removeSections(content, isTarget)
    expect(count).toBe(0)
    expect(result).toBe(content)
  })

  test('should handle <!-- from --> markers as targets', () => {
    const content = '# Config\n\n<!-- from rules/foo.md -->\nsome content\n\n## Other\nkeep'
    const isMarker = (text: string) => text.startsWith('<!-- from ')
    const { result, count } = removeSections(content, isMarker)
    expect(count).toBe(1)
    expect(result).not.toContain('foo.md')
    expect(result).toContain('## Other')
  })

  test('should handle multiple markers', () => {
    const content =
      '# Config\n\n<!-- from rules/foo.md -->\ncontent1\n\n<!-- from rules/bar.md -->\ncontent2'
    const isMarker = (text: string) => text.startsWith('<!-- from ')
    const { result, count } = removeSections(content, isMarker)
    expect(count).toBe(2)
    expect(result).toBe('# Config\n')
  })
})

describe('uninstallOpenCode', () => {
  test('should remove item from config and delete file when installed', () => {
    const config = {
      instructions: ['.opencode/rules/ts.md', '.opencode/skills/test.md'],
    }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))
    mockExistsSync.mockReturnValue(true)

    const result = uninstallOpenCode('/project/opencode.jsonc', '/project', 'rules/ts')

    expect(result).toBe(true)
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/project/opencode.jsonc',
      expect.stringContaining('.opencode/skills/test.md'),
      'utf-8'
    )
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/project/opencode.jsonc',
      expect.not.stringContaining('rules/ts.md'),
      'utf-8'
    )
    expect(mockUnlinkSync).toHaveBeenCalledWith('/project/.opencode/rules/ts.md')
  })

  test('should return false when item not in config', () => {
    const config = {
      instructions: ['.opencode/skills/test.md'],
    }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))

    const result = uninstallOpenCode('/project/opencode.jsonc', '/project', 'rules/ts')

    expect(result).toBe(false)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  test('should delete file only when it exists', () => {
    const config = {
      instructions: ['.opencode/rules/ts.md'],
    }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))
    mockExistsSync.mockReturnValue(false)

    uninstallOpenCode('/project/opencode.jsonc', '/project', 'rules/ts')

    expect(mockUnlinkSync).not.toHaveBeenCalled()
  })
})

describe('uninstallAllOpenCode', () => {
  test('should remove all .opencode entries and files', () => {
    const config = {
      instructions: ['.opencode/rules/ts.md', '.opencode/skills/test.md', 'other/file.md'],
    }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))
    mockExistsSync.mockReturnValue(true)

    const count = uninstallAllOpenCode('/project/opencode.jsonc', '/project')

    expect(count).toBe(2)
    expect(mockUnlinkSync).toHaveBeenCalledWith('/project/.opencode/rules/ts.md')
    expect(mockUnlinkSync).toHaveBeenCalledWith('/project/.opencode/skills/test.md')
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  test('should return 0 when no .opencode entries', () => {
    const config = {
      instructions: ['other/file.md'],
    }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))

    const count = uninstallAllOpenCode('/project/opencode.jsonc', '/project')

    expect(count).toBe(0)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })
})

describe('uninstallClaudeCode', () => {
  test('should remove section with source tag', () => {
    const content = [
      '# Config',
      '',
      '## TypeScript',
      '',
      '<source>rules/typescript</source>',
      '',
      '## Other',
      '',
      'stuff',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)

    const result = uninstallClaudeCode('/project/CLAUDE.md', 'rules/typescript')

    expect(result).toBe(true)
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/project/CLAUDE.md',
      expect.not.stringContaining('rules/typescript'),
      'utf-8'
    )
  })

  test('should return false when source tag not found', () => {
    mockReadFileSync.mockReturnValue('# Config\n\n')

    const result = uninstallClaudeCode('/project/CLAUDE.md', 'rules/typescript')

    expect(result).toBe(false)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })
})

describe('uninstallAllClaudeCode', () => {
  test('should remove all source-tagged sections', () => {
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

    const count = uninstallAllClaudeCode('/project/CLAUDE.md')

    expect(count).toBe(2)
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/project/CLAUDE.md',
      expect.not.stringContaining('<source>'),
      'utf-8'
    )
  })

  test('should return 0 when no source tags', () => {
    mockReadFileSync.mockReturnValue('# Config\n\n')

    const count = uninstallAllClaudeCode('/project/CLAUDE.md')

    expect(count).toBe(0)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })
})

describe('uninstallCline', () => {
  test('should remove section with HTML marker', () => {
    const content = [
      '# Config',
      '',
      '<!-- from rules/typescript -->',
      '',
      'content',
      '',
      '## Other',
      '',
      'stuff',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)

    const result = uninstallCline('/project/.clinerules', 'rules/typescript')

    expect(result).toBe(true)
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/project/.clinerules',
      expect.not.stringContaining('rules/typescript'),
      'utf-8'
    )
  })

  test('should return false when marker not found', () => {
    mockReadFileSync.mockReturnValue('# Config\n\n')

    const result = uninstallCline('/project/.clinerules', 'rules/typescript')

    expect(result).toBe(false)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })
})

describe('uninstallAllCline', () => {
  test('should remove all marked sections', () => {
    const content = [
      '# Config',
      '',
      '<!-- from rules/ts -->',
      '',
      'content1',
      '',
      '<!-- from rules/test -->',
      '',
      'content2',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)

    const count = uninstallAllCline('/project/.clinerules')

    expect(count).toBe(2)
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/project/.clinerules',
      expect.not.stringContaining('<!-- from'),
      'utf-8'
    )
  })

  test('should return 0 when no markers', () => {
    mockReadFileSync.mockReturnValue('# Config\n\n')

    const count = uninstallAllCline('/project/.clinerules')

    expect(count).toBe(0)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })
})

function createMockServer() {
  let installHandler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  let uninstallAllHandler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  const server = {
    tool: (
      name: string,
      _desc: string,
      _schema: Record<string, unknown>,
      cb: ((args: Record<string, unknown>) => Promise<unknown>) | null
    ) => {
      if (name === 'uninstall') {
        installHandler = cb
      } else if (name === 'uninstall_all') {
        uninstallAllHandler = cb
      }
      return server
    },
  } as unknown as McpServer
  return {
    server,
    getInstallHandler: () => installHandler!,
    getUninstallAllHandler: () => uninstallAllHandler!,
  }
}

describe('registerUninstallTool', () => {
  test('should uninstall opencode item', async () => {
    const { server, getInstallHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    const config = { instructions: ['.opencode/rules/ts.md'] }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))

    registerUninstallTool(server, store)
    const handler = getInstallHandler()
    const result = (await handler({
      path: 'rules/ts',
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.uninstalled).toBe('rules/ts')
    expect(parsed.agent).toBe('opencode')
  })

  test('should uninstall claude-code item', async () => {
    const { server, getInstallHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('claude-code')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/CLAUDE.md',
      agent: 'claude-code',
    })
    mockReadFileSync.mockReturnValue('## TS\n\n<source>rules/ts</source>\n')

    registerUninstallTool(server, store)
    const handler = getInstallHandler()
    const result = (await handler({
      path: 'rules/ts',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.uninstalled).toBe('rules/ts')
  })

  test('should uninstall cline item', async () => {
    const { server, getInstallHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('cline')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.clinerules',
      agent: 'cline',
    })
    mockReadFileSync.mockReturnValue('<!-- from rules/ts -->\n')

    registerUninstallTool(server, store)
    const handler = getInstallHandler()
    const result = (await handler({
      path: 'rules/ts',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.uninstalled).toBe('rules/ts')
  })

  test('should return not found message when item not installed', async () => {
    const { server, getInstallHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    mockReadFileSync.mockReturnValue(JSON.stringify({}))

    registerUninstallTool(server, store)
    const handler = getInstallHandler()
    const result = (await handler({
      path: 'rules/ts',
    })) as ToolContent
    expect(result.content[0].text).toContain('Not found')
  })

  test('should return error when no config found', async () => {
    const { server, getInstallHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue(null)

    registerUninstallTool(server, store)
    const handler = getInstallHandler()
    const result = (await handler({
      path: 'rules/ts',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })

  test('should uninstall all opencode items', async () => {
    const { server, getUninstallAllHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    const config = {
      instructions: ['.opencode/rules/ts.md', '.opencode/skills/test.md'],
    }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))

    registerUninstallTool(server, store)
    const handler = getUninstallAllHandler()
    const result = (await handler({
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.uninstalledCount).toBe(2)
  })

  test('should uninstall all claude-code items', async () => {
    const { server, getUninstallAllHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('claude-code')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/CLAUDE.md',
      agent: 'claude-code',
    })
    mockReadFileSync.mockReturnValue(
      '## TS\n\n<source>rules/ts</source>\n## Test\n\n<source>rules/test</source>\n'
    )

    registerUninstallTool(server, store)
    const handler = getUninstallAllHandler()
    const result = (await handler({})) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.uninstalledCount).toBe(2)
  })

  test('should uninstall all cline items', async () => {
    const { server, getUninstallAllHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('cline')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.clinerules',
      agent: 'cline',
    })
    mockReadFileSync.mockReturnValue('<!-- from rules/ts -->\n<!-- from rules/test -->\n')

    registerUninstallTool(server, store)
    const handler = getUninstallAllHandler()
    const result = (await handler({})) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.uninstalledCount).toBe(2)
  })

  test('should return empty message when no items to uninstall all', async () => {
    const { server, getUninstallAllHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    mockReadFileSync.mockReturnValue(JSON.stringify({}))

    registerUninstallTool(server, store)
    const handler = getUninstallAllHandler()
    const result = (await handler({})) as ToolContent
    expect(result.content[0].text).toContain('No aik-managed items found')
  })

  test('should return error for uninstall_all when no config', async () => {
    const { server, getUninstallAllHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue(null)

    registerUninstallTool(server, store)
    const handler = getUninstallAllHandler()
    const result = (await handler({})) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })
})
