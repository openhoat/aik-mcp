import { describe, expect, test } from 'vitest'

const { CODEX_AGENT, CODEX_INSTALL_SPECS, CODEX_CONFIG } = await import('./codex.js')

describe('CODEX_AGENT', () => {
  test('should have correct name', () => {
    expect(CODEX_AGENT.name).toBe('codex')
  })

  test('should have correct display name', () => {
    expect(CODEX_AGENT.displayName).toBe('Codex')
  })

  test('should have detection priority 7', () => {
    expect(CODEX_AGENT.detectionPriority).toBe(7)
  })

  test('should return config path', () => {
    expect(CODEX_AGENT.configPath('/project')).toBe('/project/.codex')
  })
})

describe('CODEX_INSTALL_SPECS', () => {
  test('should have section format for rules', () => {
    const spec = CODEX_INSTALL_SPECS.rules
    expect(spec.format).toBe('section')
    expect(spec.configUpdate).toBe('codex-agents-md')
  })

  test('should have directory-skill format for skills', () => {
    const spec = CODEX_INSTALL_SPECS.skills
    expect(spec.format).toBe('directory-skill')
    expect(spec.configUpdate).toBe('none')
  })

  test('should have file format for agents', () => {
    const spec = CODEX_INSTALL_SPECS.agents
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('none')
  })

  test('should have file format for commands', () => {
    const spec = CODEX_INSTALL_SPECS.commands
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('none')
  })

  test('should have section format for workflows', () => {
    const spec = CODEX_INSTALL_SPECS.workflows
    expect(spec.format).toBe('section')
    expect(spec.configUpdate).toBe('codex-agents-md')
  })

  test('should have file format for templates', () => {
    const spec = CODEX_INSTALL_SPECS.templates
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('none')
  })

  test('should compute correct content paths', () => {
    const rulesPath = CODEX_INSTALL_SPECS.rules.contentPath('/project', 'rules', 'my-rule')
    expect(rulesPath).toBe('/project/AGENTS.md')

    const skillsPath = CODEX_INSTALL_SPECS.skills.contentPath('/project', 'skills', 'my-skill')
    expect(skillsPath).toBe('/project/.codex/skills/my-skill/SKILL.md')

    const agentsPath = CODEX_INSTALL_SPECS.agents.contentPath('/project', 'agents', 'my-agent')
    expect(agentsPath).toBe('/project/.codex/agents/my-agent.md')

    const commandsPath = CODEX_INSTALL_SPECS.commands.contentPath('/project', 'commands', 'my-cmd')
    expect(commandsPath).toBe('/project/.codex/commands/my-cmd.md')

    const workflowsPath = CODEX_INSTALL_SPECS.workflows.contentPath(
      '/project',
      'workflows',
      'my-wf'
    )
    expect(workflowsPath).toBe('/project/AGENTS.md')

    const templatesPath = CODEX_INSTALL_SPECS.templates.contentPath(
      '/project',
      'templates',
      'my-tpl'
    )
    expect(templatesPath).toBe('/project/.codex/templates/my-tpl.md')
  })
})

describe('CODEX_CONFIG', () => {
  test('should reference CODEX_AGENT', () => {
    expect(CODEX_CONFIG.agent).toBe(CODEX_AGENT)
  })

  test('should reference CODEX_INSTALL_SPECS', () => {
    expect(CODEX_CONFIG.installSpecs).toBe(CODEX_INSTALL_SPECS)
  })

  test('should not have instructionsCategories', () => {
    expect(CODEX_CONFIG.instructionsCategories).toBeUndefined()
  })
})
