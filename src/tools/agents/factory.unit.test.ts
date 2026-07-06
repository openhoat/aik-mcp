import { describe, expect, test } from 'vitest'

const { getAgentConfig, getInstallSpec, getInstructionsCategories, getAllAgents } = await import(
  './factory.js'
)

describe('getAgentConfig', () => {
  test('should return opencode config', () => {
    const config = getAgentConfig('opencode')
    expect(config.agent.name).toBe('opencode')
    expect(config.agent.displayName).toBe('OpenCode')
  })

  test('should return claude-code config', () => {
    const config = getAgentConfig('claude-code')
    expect(config.agent.name).toBe('claude-code')
    expect(config.agent.displayName).toBe('Claude Code')
  })

  test('should return cline config', () => {
    const config = getAgentConfig('cline')
    expect(config.agent.name).toBe('cline')
    expect(config.agent.displayName).toBe('Cline')
  })

  test('should return codex config', () => {
    const config = getAgentConfig('codex')
    expect(config.agent.name).toBe('codex')
    expect(config.agent.displayName).toBe('Codex')
  })

  test('should return copilot config', () => {
    const config = getAgentConfig('copilot')
    expect(config.agent.name).toBe('copilot')
    expect(config.agent.displayName).toBe('GitHub Copilot')
  })
})

describe('getInstallSpec', () => {
  test('should return file format for opencode rules', () => {
    const spec = getInstallSpec('opencode', 'rules')
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('opencode-instructions')
  })

  test('should return directory-skill format for opencode skills', () => {
    const spec = getInstallSpec('opencode', 'skills')
    expect(spec.format).toBe('directory-skill')
  })

  test('should return section format for claude-code rules', () => {
    const spec = getInstallSpec('claude-code', 'rules')
    expect(spec.format).toBe('section')
    expect(spec.configUpdate).toBe('claude-md-section')
  })

  test('should return file format for cline rules', () => {
    const spec = getInstallSpec('cline', 'rules')
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('none')
  })

  test('should return section format for codex rules', () => {
    const spec = getInstallSpec('codex', 'rules')
    expect(spec.format).toBe('section')
    expect(spec.configUpdate).toBe('codex-agents-md')
  })

  test('should return directory-skill format for codex skills', () => {
    const spec = getInstallSpec('codex', 'skills')
    expect(spec.format).toBe('directory-skill')
  })

  test('should return file format for codex agents', () => {
    const spec = getInstallSpec('codex', 'agents')
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('none')
  })

  test('should return section format for copilot rules', () => {
    const spec = getInstallSpec('copilot', 'rules')
    expect(spec.format).toBe('section')
    expect(spec.configUpdate).toBe('none')
  })

  test('should return file format for copilot skills', () => {
    const spec = getInstallSpec('copilot', 'skills')
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('none')
  })
})

describe('getInstructionsCategories', () => {
  test('should return categories for opencode', () => {
    const cats = getInstructionsCategories('opencode')
    expect(cats).toContain('rules')
    expect(cats).toContain('workflows')
    expect(cats).toContain('templates')
  })

  test('should return empty for claude-code', () => {
    const cats = getInstructionsCategories('claude-code')
    expect(cats).toEqual([])
  })

  test('should return empty for cline', () => {
    const cats = getInstructionsCategories('cline')
    expect(cats).toEqual([])
  })

  test('should return empty for codex', () => {
    const cats = getInstructionsCategories('codex')
    expect(cats).toEqual([])
  })

  test('should return empty for copilot', () => {
    const cats = getInstructionsCategories('copilot')
    expect(cats).toEqual([])
  })
})

describe('getAllAgents', () => {
  test('should return all agents', () => {
    const agents = getAllAgents()
    expect(agents).toContain('opencode')
    expect(agents).toContain('claude-code')
    expect(agents).toContain('cline')
    expect(agents).toContain('codex')
    expect(agents).toContain('copilot')
    expect(agents.length).toBe(5)
  })
})
