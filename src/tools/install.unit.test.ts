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
  uninstallContent: vi.fn(),
}))

const { openCodeConfigPath, installContent, registerInstallTool, registerReinstallTool } =
  await import('./install.js')

const mockDetectAgent = (await import('./shared.js')).detectAgent as Mock
const mockFindExistingConfig = (await import('./shared.js')).findExistingConfig as Mock
const mockUninstallContent = (await import('./uninstall.js')).uninstallContent as Mock

beforeEach(() => {
  mockExistsSync.mockReset()
  mockReadFileSync.mockReset()
  mockWriteFileSync.mockReset()
  mockMkdirSync.mockReset()
  mockAppendFileSync.mockReset()
  mockDetectAgent.mockReset()
  mockFindExistingConfig.mockReset()
  mockUninstallContent.mockReset()
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

describe('installContent - opencode rules (file format)', () => {
  test('should install rule file and update instructions', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({}))
    mockExistsSync.mockReturnValue(false)

    const result = installContent(
      'opencode',
      'rules',
      'my-rule',
      'rules/my-rule',
      'My Rule',
      '# My Rule',
      '/project',
      '/project/.opencode/opencode.jsonc'
    )

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.opencode/rules/my-rule.md'),
      '# My Rule',
      'utf-8'
    )
    expect(result.alreadyInstalled).toBe(false)
  })

  test('should detect already installed via instructions', () => {
    const config = { instructions: ['.opencode/rules/my-rule.md'] }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))
    mockExistsSync.mockReturnValue(true)

    const result = installContent(
      'opencode',
      'rules',
      'my-rule',
      'rules/my-rule',
      'My Rule',
      '# My Rule',
      '/project',
      '/project/.opencode/opencode.jsonc'
    )

    expect(result.alreadyInstalled).toBe(true)
  })
})

describe('installContent - opencode skills (directory-skill format)', () => {
  test('should create SKILL.md in skill directory', () => {
    mockExistsSync.mockReturnValue(false)

    const result = installContent(
      'opencode',
      'skills',
      'my-skill',
      'skills/my-skill',
      'My Skill',
      '---\ndescription: A test skill\n---\n# My Skill\nbody',
      '/project',
      null
    )

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('.opencode/skills/my-skill'),
      { recursive: true }
    )
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.opencode/skills/my-skill/SKILL.md'),
      expect.stringContaining('name: my-skill'),
      'utf-8'
    )
    expect(result.alreadyInstalled).toBe(false)
  })

  test('should detect already installed skill', () => {
    mockExistsSync.mockReturnValue(true)

    const result = installContent(
      'opencode',
      'skills',
      'my-skill',
      'skills/my-skill',
      'My Skill',
      '---\ndescription: A test skill\n---\nbody',
      '/project',
      null
    )

    expect(result.alreadyInstalled).toBe(true)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })
})

describe('installContent - opencode agents (file, no config update)', () => {
  test('should write agent file without updating instructions', () => {
    mockExistsSync.mockReturnValue(false)

    const result = installContent(
      'opencode',
      'agents',
      'code-reviewer',
      'agents/code-reviewer',
      'Code Reviewer',
      '# Code Reviewer',
      '/project',
      null
    )

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.opencode/agents/code-reviewer.md'),
      '# Code Reviewer',
      'utf-8'
    )
    expect(result.alreadyInstalled).toBe(false)
  })
})

describe('installContent - claude-code rules (section format)', () => {
  test('should append section to CLAUDE.md', () => {
    mockExistsSync.mockReturnValue(false)

    const result = installContent(
      'claude-code',
      'rules',
      'my-rule',
      'rules/my-rule',
      'My Rule',
      '# Content',
      '/project',
      null
    )

    expect(mockAppendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('CLAUDE.md'),
      expect.stringContaining('rules/my-rule'),
      'utf-8'
    )
    expect(result.alreadyInstalled).toBe(false)
  })

  test('should detect already installed section', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('<source>rules/my-rule</source>')

    const result = installContent(
      'claude-code',
      'rules',
      'my-rule',
      'rules/my-rule',
      'My Rule',
      '# Content',
      '/project',
      '/project/CLAUDE.md'
    )

    expect(mockAppendFileSync).not.toHaveBeenCalled()
    expect(result.alreadyInstalled).toBe(true)
  })
})

describe('installContent - claude-code skills (directory-skill format)', () => {
  test('should create SKILL.md in .claude/skills/', () => {
    mockExistsSync.mockReturnValue(false)

    const result = installContent(
      'claude-code',
      'skills',
      'my-skill',
      'skills/my-skill',
      'My Skill',
      '---\ndescription: A skill\n---\nbody',
      '/project',
      null
    )

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('.claude/skills/my-skill'), {
      recursive: true,
    })
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.claude/skills/my-skill/SKILL.md'),
      expect.stringContaining('name: my-skill'),
      'utf-8'
    )
    expect(result.alreadyInstalled).toBe(false)
  })
})

describe('installContent - claude-code agents (file format)', () => {
  test('should write agent file to .claude/agents/', () => {
    mockExistsSync.mockReturnValue(false)

    const result = installContent(
      'claude-code',
      'agents',
      'code-reviewer',
      'agents/code-reviewer',
      'Code Reviewer',
      '# Code Reviewer',
      '/project',
      null
    )

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.claude/agents/code-reviewer.md'),
      '# Code Reviewer',
      'utf-8'
    )
    expect(result.alreadyInstalled).toBe(false)
  })
})

describe('installContent - cline rules (file format)', () => {
  test('should write rule file to .clinerules/', () => {
    mockExistsSync.mockReturnValue(false)

    const result = installContent(
      'cline',
      'rules',
      'my-rule',
      'rules/my-rule',
      'My Rule',
      '# My Rule',
      '/project',
      null
    )

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('.clinerules'), {
      recursive: true,
    })
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.clinerules/my-rule.md'),
      '# My Rule',
      'utf-8'
    )
    expect(result.alreadyInstalled).toBe(false)
  })
})

describe('installContent - cline skills (directory-skill format)', () => {
  test('should create SKILL.md in .cline/skills/', () => {
    mockExistsSync.mockReturnValue(false)

    const result = installContent(
      'cline',
      'skills',
      'my-skill',
      'skills/my-skill',
      'My Skill',
      '---\ndescription: A skill\n---\nbody',
      '/project',
      null
    )

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('.cline/skills/my-skill'), {
      recursive: true,
    })
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.cline/skills/my-skill/SKILL.md'),
      expect.stringContaining('name: my-skill'),
      'utf-8'
    )
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
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.opencode/opencode.jsonc',
      agent: 'opencode',
    })
    mockUninstallContent.mockReturnValue(true)
    mockReadFileSync.mockImplementation((path: string) =>
      path.includes('opencode.jsonc') ? JSON.stringify({}) : '# My Rule\ncontent'
    )
    mockExistsSync.mockReturnValue(false)

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
    expect(mockUninstallContent).toHaveBeenCalled()
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
