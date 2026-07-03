import { resolve } from 'node:path'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ContentStore } from '../content-store.js'

type ToolContent = { content: Array<{ type: string; text: string }> }
type ToolResult = ToolContent & { isError?: boolean }

const mockReadFileSync = jest.fn<(path: string, encoding?: string) => string>()

jest.unstable_mockModule('node:fs', () => ({
  readFileSync: mockReadFileSync,
}))

jest.unstable_mockModule('../logger.js', () => ({
  logger: { trace: jest.fn() },
}))

jest.unstable_mockModule('./shared.js', () => ({
  detectAgent: jest.fn<(dir: string, preferred?: string) => string>(),
  findExistingConfig: jest.fn<
    (dir: string) => { path: string; agent: string } | null
  >(),
  AGENTS: ['opencode', 'claude-code', 'cline'],
}))

const {
  listInstalledOpenCode,
  listInstalledClaudeCode,
  listInstalledCline,
  registerListInstalledTool,
} = await import('./list-installed.js')

const mockDetectAgent =
  (await import('./shared.js')).detectAgent as jest.Mock
const mockFindExistingConfig =
  (await import('./shared.js')).findExistingConfig as jest.Mock

beforeEach(() => {
  mockReadFileSync.mockReset()
  mockDetectAgent.mockReset()
  mockFindExistingConfig.mockReset()
})

describe('listInstalledOpenCode', () => {
  test('should return installed items from config instructions', () => {
    const config = {
      instructions: [
        '.opencode/rules/typescript.md',
        '.opencode/skills/test-skill.md',
      ],
    }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))

    const result = listInstalledOpenCode('/project/opencode.jsonc', '/project')

    expect(result).toHaveLength(2)
    expect(result[0].path).toBe('rules/typescript')
    expect(result[1].path).toBe('skills/test-skill')
  })

  test('should skip non-.opencode entries', () => {
    const config = {
      instructions: [
        '.opencode/rules/ts.md',
        'other/file',
      ],
    }
    mockReadFileSync.mockReturnValue(JSON.stringify(config))

    const result = listInstalledOpenCode('/project/opencode.jsonc', '/project')

    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('rules/ts')
  })

  test('should return empty when no instructions', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({}))

    const result = listInstalledOpenCode('/project/opencode.jsonc', '/project')

    expect(result).toHaveLength(0)
  })
})

describe('listInstalledClaudeCode', () => {
  test('should extract items from source tags in sections', () => {
    const content = [
      '# Docs',
      '',
      '## TypeScript',
      '',
      '<source>rules/typescript</source>',
      '',
      '## Testing',
      '',
      '<source>rules/testing</source>',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)

    const result = listInstalledClaudeCode('/project/CLAUDE.md')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ path: 'rules/typescript', title: 'TypeScript' })
    expect(result[1]).toEqual({ path: 'rules/testing', title: 'Testing' })
  })

  test('should handle content with extra formatting', () => {
    const content = [
      '## My Rule',
      '',
      'Description here',
      '',
      '<source>rules/my-rule</source>',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)

    const result = listInstalledClaudeCode('/project/CLAUDE.md')

    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('rules/my-rule')
    expect(result[0].title).toBe('My Rule')
  })

  test('should return empty when no source tags', () => {
    mockReadFileSync.mockReturnValue('# Just a header\n\nSome text')

    const result = listInstalledClaudeCode('/project/CLAUDE.md')

    expect(result).toHaveLength(0)
  })
})

describe('listInstalledCline', () => {
  test('should extract items from HTML markers', () => {
    const content = [
      '# Rules',
      '',
      '<!-- from rules/typescript -->',
      'content',
      '',
      '<!-- from skills/my-skill -->',
      'more content',
      '',
    ].join('\n')
    mockReadFileSync.mockReturnValue(content)

    const result = listInstalledCline('/project/.clinerules')

    expect(result).toHaveLength(2)
    expect(result[0].path).toBe('rules/typescript')
    expect(result[1].path).toBe('skills/my-skill')
  })

  test('should return empty when no markers', () => {
    mockReadFileSync.mockReturnValue('# Just a header')

    const result = listInstalledCline('/project/.clinerules')

    expect(result).toHaveLength(0)
  })
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
  test('should return items for opencode agent', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        instructions: ['.opencode/rules/ts.md'],
      })
    )

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.agent).toBe('opencode')
    expect(parsed.count).toBe(1)
    expect(parsed.items[0].path).toBe('rules/ts')
  })

  test('should return items for claude-code agent', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('claude-code')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/CLAUDE.md',
      agent: 'claude-code',
    })
    mockReadFileSync.mockReturnValue(
      '## TS\n\n<source>rules/ts</source>\n'
    )

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.agent).toBe('claude-code')
    expect(parsed.count).toBe(1)
  })

  test('should return items for cline agent', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('cline')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/.clinerules',
      agent: 'cline',
    })
    mockReadFileSync.mockReturnValue('<!-- from rules/ts -->\n')

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
    })) as ToolContent
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.agent).toBe('cline')
    expect(parsed.count).toBe(1)
  })

  test('should return empty message when no items', async () => {
    const { server, getHandler } = createMockServer()
    const store = {} as ContentStore
    mockDetectAgent.mockReturnValue('opencode')
    mockFindExistingConfig.mockReturnValue({
      path: '/project/opencode.jsonc',
      agent: 'opencode',
    })
    mockReadFileSync.mockReturnValue(JSON.stringify({}))

    registerListInstalledTool(server, store)
    const handler = getHandler()
    const result = (await handler({
      projectDir: '/project',
    })) as ToolContent
    expect(result.content[0].text).toContain(
      'No aik-installed items found'
    )
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
