import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { beforeEach, describe, expect, type Mock, test } from 'vitest'
import type { ContentStore } from '../content-store.js'

type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

const mockReadFileSync = vi.fn<(path: string, encoding?: string) => string>()
const mockWriteFileSync = vi.fn<(path: string, data: string, encoding?: string) => void>()
const mockExistsSync = vi.fn<(path: string) => boolean>()
const mockUnlinkSync = vi.fn<(path: string) => void>()
const mockRmSync = vi.fn<(path: string, opts?: { recursive?: boolean; force?: boolean }) => void>()
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
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  unlinkSync: mockUnlinkSync,
  rmSync: mockRmSync,
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

const { removeSections, uninstallContent, registerUninstallTool } = await import('./uninstall.js')

const mockFindExistingConfig = (await import('./shared.js')).findExistingConfig as Mock

beforeEach(() => {
  mockReadFileSync.mockReset()
  mockWriteFileSync.mockReset()
  mockExistsSync.mockReset()
  mockUnlinkSync.mockReset()
  mockRmSync.mockReset()
  mockStatSync.mockReset()
  mockReaddirSync.mockReset()
  mockFindExistingConfig.mockReset()
  mockStatSync.mockReturnValue({ isDirectory: () => false })
})

describe('removeSections', () => {
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
    const content = '# Header\n\n## test-section\nsome content\n\n## other\nkeep this'
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
    const content = '# Header\n\n## test-section\ncontent until EOF'
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
})

describe('uninstallContent - opencode rules (file format)', () => {
  test('should remove item from config and delete file', () => {
    const config = { instructions: ['.opencode/rules/ts.md', '.opencode/skills/test.md'] }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))
    mockExistsSync.mockReturnValue(true)

    const result = uninstallContent(
      'opencode',
      'rules',
      'ts',
      'rules/ts',
      '/project',
      '/project/.opencode/opencode.jsonc'
    )

    expect(result).toBe(true)
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/project/.opencode/opencode.jsonc',
      expect.stringContaining('.opencode/skills/test.md'),
      'utf-8'
    )
    expect(mockUnlinkSync).toHaveBeenCalledWith(expect.stringContaining('.opencode/rules/ts.md'))
  })

  test('should return false when item not in config', () => {
    const config = { instructions: ['.opencode/skills/test.md'] }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))
    mockExistsSync.mockReturnValue(false)

    const result = uninstallContent(
      'opencode',
      'rules',
      'ts',
      'rules/ts',
      '/project',
      '/project/.opencode/opencode.jsonc'
    )

    expect(result).toBe(false)
  })
})

describe('uninstallContent - opencode skills (directory-skill format)', () => {
  test('should remove skill directory', () => {
    mockExistsSync.mockReturnValue(true)

    const result = uninstallContent(
      'opencode',
      'skills',
      'my-skill',
      'skills/my-skill',
      '/project',
      null
    )

    expect(result).toBe(true)
    expect(mockRmSync).toHaveBeenCalledWith(expect.stringContaining('.opencode/skills/my-skill'), {
      recursive: true,
      force: true,
    })
  })

  test('should return false when skill not found', () => {
    mockExistsSync.mockReturnValue(false)

    const result = uninstallContent(
      'opencode',
      'skills',
      'my-skill',
      'skills/my-skill',
      '/project',
      null
    )

    expect(result).toBe(false)
  })
})

describe('uninstallContent - claude-code rules (section format)', () => {
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
    mockExistsSync.mockReturnValue(true)

    const result = uninstallContent(
      'claude-code',
      'rules',
      'typescript',
      'rules/typescript',
      '/project',
      '/project/CLAUDE.md'
    )

    expect(result).toBe(true)
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/project/CLAUDE.md',
      expect.not.stringContaining('rules/typescript'),
      'utf-8'
    )
  })

  test('should return false when source tag not found', () => {
    mockReadFileSync.mockReturnValue('# Config\n\n')
    mockExistsSync.mockReturnValue(true)

    const result = uninstallContent(
      'claude-code',
      'rules',
      'typescript',
      'rules/typescript',
      '/project',
      '/project/CLAUDE.md'
    )

    expect(result).toBe(false)
  })
})

describe('uninstallContent - claude-code agents (file format)', () => {
  test('should delete agent file', () => {
    mockExistsSync.mockReturnValue(true)

    const result = uninstallContent(
      'claude-code',
      'agents',
      'code-reviewer',
      'agents/code-reviewer',
      '/project',
      null
    )

    expect(result).toBe(true)
    expect(mockUnlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('.claude/agents/code-reviewer.md')
    )
  })
})

describe('uninstallContent - cline rules (file format)', () => {
  test('should delete rule file from .clinerules/', () => {
    mockExistsSync.mockReturnValue(true)

    const result = uninstallContent('cline', 'rules', 'my-rule', 'rules/my-rule', '/project', null)

    expect(result).toBe(true)
    expect(mockUnlinkSync).toHaveBeenCalledWith(expect.stringContaining('.clinerules/my-rule.md'))
  })

  test('should return false when file does not exist', () => {
    mockExistsSync.mockReturnValue(false)

    const result = uninstallContent('cline', 'rules', 'my-rule', 'rules/my-rule', '/project', null)

    expect(result).toBe(false)
  })
})

const createMockServer = () => {
  let installHandler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  let uninstallAllHandler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null
  const server = {
    registerTool: (
      name: string,
      _config: Record<string, unknown>,
      cb: ((args: Record<string, unknown>) => Promise<unknown>) | null
    ) => {
      if (name === 'uninstall') {
        installHandler = cb
      } else if (name === 'uninstall_all') {
        uninstallAllHandler = cb
      }
      return server
    },
  } as unknown as McpServer // Safe: test mock type limitation
  return {
    server,
    getInstallHandler: () => installHandler!,
    getUninstallAllHandler: () => uninstallAllHandler!,
  }
}

describe('registerUninstallTool', () => {
  test('should uninstall opencode item', async () => {
    const { server, getInstallHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    const config = { instructions: ['.opencode/rules/ts.md'] }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))
    mockExistsSync.mockReturnValue(true)

    registerUninstallTool(server, store)
    const handler = getInstallHandler()
    const result = (await handler({
      path: 'rules/ts',
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.uninstalled).toBe('rules/ts')
    expect(parsed.agent).toBe('opencode')
  })

  test('should uninstall claude-code item', async () => {
    const { server, getInstallHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/CLAUDE.md',
      agent: 'claude-code',
    })
    mockReadFileSync.mockReturnValue('## TS\n\n<source>rules/ts</source>\n')
    mockExistsSync.mockReturnValue(true)

    registerUninstallTool(server, store)
    const handler = getInstallHandler()
    const result = (await handler({
      path: 'rules/ts',
      projectDir: '/project',
      agent: 'claude-code',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.uninstalled).toBe('rules/ts')
  })

  test('should uninstall cline item', async () => {
    const { server, getInstallHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.clinerules',
      agent: 'cline',
    })
    mockExistsSync.mockReturnValue(true)

    registerUninstallTool(server, store)
    const handler = getInstallHandler()
    const result = (await handler({
      path: 'rules/ts',
      projectDir: '/project',
      agent: 'cline',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.uninstalled).toBe('rules/ts')
  })

  test('should return not found message when item not installed', async () => {
    const { server, getInstallHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockReadFileSync.mockReturnValue(JSON.stringify({}))
    mockExistsSync.mockReturnValue(false)

    registerUninstallTool(server, store)
    const handler = getInstallHandler()
    const result = (await handler({
      path: 'rules/ts',
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolContent
    expect(result.content[0].text).toContain('Not found')
  })

  test('should return error when no config found', async () => {
    const { server, getInstallHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue(null)

    registerUninstallTool(server, store)
    const handler = getInstallHandler()
    const result = (await handler({
      path: 'rules/ts',
      projectDir: '/project',
      agent: 'opencode',
    })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })

  test('should return error for uninstall_all when no config', async () => {
    const { server, getUninstallAllHandler } = createMockServer()
    const store = {} as ContentStore // Safe: test mock type limitation
    mockFindExistingConfig.mockReturnValue(null)

    registerUninstallTool(server, store)
    const handler = getUninstallAllHandler()
    const result = (await handler({ agent: 'opencode' })) as ToolResult
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No config file found')
  })
})
