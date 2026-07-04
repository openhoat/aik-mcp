import { resolve } from 'node:path'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const mockExistsSync = jest.fn<(path: string) => boolean>()

await jest.unstable_mockModule('node:fs', () => ({
  existsSync: mockExistsSync,
}))

const { detectAgent, findExistingConfig } = await import('./shared.js')

describe('shared', () => {
  beforeEach(() => {
    mockExistsSync.mockReset()
  })

  describe('detectAgent', () => {
    test('should return preferred agent when valid', () => {
      expect(detectAgent('/some/dir', 'cline')).toBe('cline')
      expect(detectAgent('/some/dir', 'opencode')).toBe('opencode')
      expect(detectAgent('/some/dir', 'claude-code')).toBe('claude-code')
    })

    test('should return opencode when no config found and no preferred', () => {
      mockExistsSync.mockReturnValue(false)
      expect(detectAgent('/empty/dir')).toBe('opencode')
    })

    test('should detect agent from existing config', () => {
      mockExistsSync.mockImplementation((path: string) => path.includes('.opencode/opencode.jsonc'))
      expect(detectAgent('/project')).toBe('opencode')
    })
  })

  describe('findExistingConfig', () => {
    test('should return null when no config found', () => {
      mockExistsSync.mockReturnValue(false)
      expect(findExistingConfig('/empty/dir')).toBeNull()
    })

    test('should find .opencode/opencode.jsonc', () => {
      const targetPath = resolve('/project', '.opencode', 'opencode.jsonc')
      mockExistsSync.mockImplementation((path: string) => path === targetPath)
      const result = findExistingConfig('/project')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.agent).toBe('opencode')
        expect(result.path).toContain('.opencode/opencode.jsonc')
      }
    })

    test('should find .opencode/opencode.json', () => {
      mockExistsSync.mockImplementation(
        (path: string) => path === resolve('/project', '.opencode', 'opencode.json')
      )
      const result = findExistingConfig('/project')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.agent).toBe('opencode')
      }
    })

    test('should find opencode.json at root', () => {
      mockExistsSync.mockImplementation(
        (path: string) => path === resolve('/project', 'opencode.json')
      )
      const result = findExistingConfig('/project')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.agent).toBe('opencode')
      }
    })

    test('should find CLAUDE.md', () => {
      mockExistsSync.mockImplementation((path: string) => path === resolve('/project', 'CLAUDE.md'))
      const result = findExistingConfig('/project')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.agent).toBe('claude-code')
      }
    })

    test('should find .clinerules', () => {
      mockExistsSync.mockImplementation(
        (path: string) => path === resolve('/project', '.clinerules')
      )
      const result = findExistingConfig('/project')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.agent).toBe('cline')
      }
    })

    test('should walk up directories', () => {
      // Config found in parent dir (/project) when starting from a subdir
      mockExistsSync.mockImplementation(
        (path: string) => path === resolve('/project', '.opencode', 'opencode.jsonc')
      )
      const result = findExistingConfig('/project/sub/deep')
      expect(result).not.toBeNull()
      if (result) {
        expect(result.agent).toBe('opencode')
      }
    })

    test('should stop at filesystem root', () => {
      mockExistsSync.mockReturnValue(false)
      expect(findExistingConfig('/')).toBeNull()
    })
  })
})
