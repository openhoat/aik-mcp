import { describe, expect, test } from 'vitest'
import {
  getAgentConfig,
  getAllAgents,
  getGlobalBaseDir,
  getLayoutEntry,
  getSupportedCategories,
  resolveContentFile,
} from './factory.js'

describe('getAgentConfig', () => {
  test('every registered agent has detection metadata and a global base dir', () => {
    for (const agent of getAllAgents()) {
      const config = getAgentConfig(agent)
      expect(config.agent.detectionPatterns.length).toBeGreaterThan(0)
      expect(typeof config.agent.globalBaseDir).toBe('function')
    }
  })
})

describe('getAllAgents', () => {
  test('returns every registered agent', () => {
    expect(getAllAgents().sort()).toEqual(
      ['claude-code', 'cline', 'codex', 'copilot', 'opencode'].sort()
    )
  })
})

describe('getSupportedCategories', () => {
  test('every agent supports all four project categories', () => {
    for (const agent of getAllAgents()) {
      expect(getSupportedCategories(agent, 'project')).toEqual([
        'rules',
        'skills',
        'workflows',
        'agents',
      ])
    }
  })

  test('global support is derived from the layout', () => {
    expect(getSupportedCategories('opencode', 'global')).toEqual([
      'rules',
      'skills',
      'workflows',
      'agents',
    ])
    expect(getSupportedCategories('cline', 'global')).toEqual(['rules'])
    expect(getSupportedCategories('codex', 'global')).toEqual(['rules', 'workflows'])
    expect(getSupportedCategories('copilot', 'global')).toEqual([])
  })
})

describe('getLayoutEntry', () => {
  test('throws for a category absent from the scope layout', () => {
    expect(() => getLayoutEntry('copilot', 'rules', 'global')).toThrow()
    expect(() => getLayoutEntry('cline', 'skills', 'global')).toThrow()
  })
})

describe('resolveContentFile', () => {
  test('interpolates the name and joins the directory', () => {
    const entry = getLayoutEntry('opencode', 'skills', 'project')
    expect(resolveContentFile(entry, '/project', 'my-skill')).toBe(
      '/project/.opencode/skills/my-skill/SKILL.md'
    )
  })

  test('keeps a literal shared filename', () => {
    const entry = getLayoutEntry('codex', 'rules', 'project')
    expect(resolveContentFile(entry, '/project', 'ignored')).toBe('/project/AGENTS.md')
  })
})

describe('getGlobalBaseDir', () => {
  test('returns an absolute directory for a global-capable agent', () => {
    expect(getGlobalBaseDir('opencode')).toContain('opencode')
  })
})
