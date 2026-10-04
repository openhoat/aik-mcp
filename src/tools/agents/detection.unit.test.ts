import { resolve } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'

const mockExistsSync = vi.fn<(path: string) => boolean>()
const mockStatSync = vi.fn<(path: string) => { isDirectory: () => boolean }>()

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  statSync: mockStatSync,
}))

const { findAgentConfig, detectAgent } = await import('./detection.js')

beforeEach(() => {
  mockExistsSync.mockReset()
  mockStatSync.mockReset()
  mockStatSync.mockReturnValue({ isDirectory: () => false })
})

describe('findAgentConfig', () => {
  const fileCases: [string, string][] = [
    ['.opencode/opencode.jsonc', 'opencode'],
    ['.opencode/opencode.json', 'opencode'],
    ['opencode.json', 'opencode'],
    ['opencode.jsonc', 'opencode'],
    ['CLAUDE.md', 'claude-code'],
    ['.clinerules', 'cline'],
    ['AGENTS.md', 'codex'],
    ['.github/copilot-instructions.md', 'copilot'],
  ]

  for (const [rel, agent] of fileCases) {
    test(`finds ${rel} as ${agent}`, () => {
      const target = resolve('/project', rel)
      mockExistsSync.mockImplementation((path: string) => path === target)

      const result = findAgentConfig('/project')

      expect(result?.agent).toBe(agent)
      expect(result?.path).toBe(target)
    })
  }

  const dirCases: [string, string][] = [
    ['.claude', 'claude-code'],
    ['.cline', 'cline'],
  ]

  for (const [rel, agent] of dirCases) {
    test(`finds the ${rel} directory as ${agent}`, () => {
      const target = resolve('/project', rel)
      mockStatSync.mockImplementation((path: string) => ({ isDirectory: () => path === target }))

      const result = findAgentConfig('/project')

      expect(result?.agent).toBe(agent)
      expect(result?.path).toBe(target)
    })
  }

  test('finds .codex/config.toml and reports AGENTS.md', () => {
    const target = resolve('/project', '.codex', 'config.toml')
    mockExistsSync.mockImplementation((path: string) => path === target)

    const result = findAgentConfig('/project')

    expect(result?.agent).toBe('codex')
    expect(result?.path).toBe(resolve('/project', 'AGENTS.md'))
  })

  test('finds the .codex directory and reports AGENTS.md', () => {
    const target = resolve('/project', '.codex')
    mockStatSync.mockImplementation((path: string) => ({ isDirectory: () => path === target }))

    const result = findAgentConfig('/project')

    expect(result?.agent).toBe('codex')
    expect(result?.path).toBe(resolve('/project', 'AGENTS.md'))
  })

  test('returns null when nothing matches', () => {
    mockExistsSync.mockReturnValue(false)
    expect(findAgentConfig('/empty/dir')).toBeNull()
  })

  test('walks up the directory tree', () => {
    const target = resolve('/project', '.opencode', 'opencode.jsonc')
    mockExistsSync.mockImplementation((path: string) => path === target)

    const result = findAgentConfig('/project/sub/dir')

    expect(result?.agent).toBe('opencode')
    expect(result?.path).toBe(target)
  })

  test('stops at the filesystem root', () => {
    mockExistsSync.mockReturnValue(false)
    expect(findAgentConfig('/')).toBeNull()
  })

  test('prefers the highest-priority agent when several match', () => {
    mockExistsSync.mockReturnValue(true)
    expect(findAgentConfig('/project')?.agent).toBe('opencode')
  })
})

describe('detectAgent', () => {
  test('returns the preferred agent when valid', () => {
    expect(detectAgent('/some/dir', 'cline')).toBe('cline')
    expect(detectAgent('/some/dir', 'opencode')).toBe('opencode')
    expect(detectAgent('/some/dir', 'claude-code')).toBe('claude-code')
  })

  test('returns opencode when no config is found and no preference is given', () => {
    mockExistsSync.mockReturnValue(false)
    expect(detectAgent('/empty/dir')).toBe('opencode')
  })

  test('returns the detected agent when no preference is given', () => {
    mockExistsSync.mockImplementation((path: string) => path.includes('.clinerules'))
    expect(detectAgent('/project')).toBe('cline')
  })
})
