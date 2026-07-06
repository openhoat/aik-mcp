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
  test('should find .opencode/opencode.jsonc (priority 1)', () => {
    const target = resolve('/project', '.opencode', 'opencode.jsonc')
    mockExistsSync.mockImplementation((path: string) => path === target)
    const result = findAgentConfig('/project')
    expect(result).not.toBeNull()
    expect(result!.agent).toBe('opencode')
    expect(result!.priority).toBe(1)
  })

  test('should find .opencode/opencode.json (priority 2)', () => {
    const target = resolve('/project', '.opencode', 'opencode.json')
    mockExistsSync.mockImplementation((path: string) => path === target)
    const result = findAgentConfig('/project')
    expect(result).not.toBeNull()
    expect(result!.agent).toBe('opencode')
    expect(result!.priority).toBe(2)
  })

  test('should find opencode.json at root (priority 3)', () => {
    const target = resolve('/project', 'opencode.json')
    mockExistsSync.mockImplementation((path: string) => path === target)
    const result = findAgentConfig('/project')
    expect(result).not.toBeNull()
    expect(result!.agent).toBe('opencode')
    expect(result!.priority).toBe(3)
  })

  test('should find opencode.jsonc at root (priority 4)', () => {
    const target = resolve('/project', 'opencode.jsonc')
    mockExistsSync.mockImplementation((path: string) => path === target)
    const result = findAgentConfig('/project')
    expect(result).not.toBeNull()
    expect(result!.agent).toBe('opencode')
    expect(result!.priority).toBe(4)
  })

  test('should find CLAUDE.md (priority 5)', () => {
    const target = resolve('/project', 'CLAUDE.md')
    mockExistsSync.mockImplementation((path: string) => path === target)
    const result = findAgentConfig('/project')
    expect(result).not.toBeNull()
    expect(result!.agent).toBe('claude-code')
    expect(result!.priority).toBe(5)
  })

  test('should find .claude directory (priority 6)', () => {
    const target = resolve('/project', '.claude')
    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockImplementation((path: string) => ({
      isDirectory: () => path === target,
    }))
    const result = findAgentConfig('/project')
    expect(result).not.toBeNull()
    expect(result!.agent).toBe('claude-code')
    expect(result!.priority).toBe(6)
  })

  test('should find .clinerules (priority 7)', () => {
    const target = resolve('/project', '.clinerules')
    mockExistsSync.mockImplementation((path: string) => path === target)
    const result = findAgentConfig('/project')
    expect(result).not.toBeNull()
    expect(result!.agent).toBe('cline')
    expect(result!.priority).toBe(7)
  })

  test('should find .cline directory (priority 8)', () => {
    const target = resolve('/project', '.cline')
    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockImplementation((path: string) => ({
      isDirectory: () => path === target,
    }))
    const result = findAgentConfig('/project')
    expect(result).not.toBeNull()
    expect(result!.agent).toBe('cline')
    expect(result!.priority).toBe(8)
  })

  test('should return null when no config found', () => {
    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue({ isDirectory: () => false })
    expect(findAgentConfig('/empty')).toBeNull()
  })

  test('should walk up directories to find config', () => {
    const target = resolve('/project', '.opencode', 'opencode.jsonc')
    mockExistsSync.mockImplementation((path: string) => path === target)
    const result = findAgentConfig('/project/sub/deep')
    expect(result).not.toBeNull()
    expect(result!.agent).toBe('opencode')
  })

  test('should stop at filesystem root', () => {
    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue({ isDirectory: () => false })
    expect(findAgentConfig('/')).toBeNull()
  })
})

describe('detectAgent', () => {
  test('should return preferred agent when valid', () => {
    expect(detectAgent('/dir', 'opencode')).toBe('opencode')
    expect(detectAgent('/dir', 'claude-code')).toBe('claude-code')
    expect(detectAgent('/dir', 'cline')).toBe('cline')
  })

  test('should return opencode default when no config and no preferred', () => {
    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue({ isDirectory: () => false })
    expect(detectAgent('/empty')).toBe('opencode')
  })

  test('should detect agent from config when no preferred', () => {
    const target = resolve('/project', '.clinerules')
    mockExistsSync.mockImplementation((path: string) => path === target)
    expect(detectAgent('/project')).toBe('cline')
  })
})
