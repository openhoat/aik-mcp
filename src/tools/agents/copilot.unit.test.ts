import { describe, expect, test } from 'vitest'

const { COPILOT_AGENT, COPILOT_INSTALL_SPECS, COPILOT_CONFIG } = await import('./copilot.js')

describe('COPILOT_AGENT', () => {
  test('should have correct name', () => {
    expect(COPILOT_AGENT.name).toBe('copilot')
  })

  test('should have correct display name', () => {
    expect(COPILOT_AGENT.displayName).toBe('GitHub Copilot')
  })

  test('should have detection priority 12', () => {
    expect(COPILOT_AGENT.detectionPriority).toBe(12)
  })

  test('should return config path', () => {
    expect(COPILOT_AGENT.configPath('/project')).toBe('/project/.github/copilot-instructions.md')
  })
})

describe('COPILOT_INSTALL_SPECS', () => {
  test('should have section format for rules', () => {
    const spec = COPILOT_INSTALL_SPECS.rules
    expect(spec.format).toBe('section')
    expect(spec.configUpdate).toBe('none')
  })

  test('should have file format for skills', () => {
    const spec = COPILOT_INSTALL_SPECS.skills
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('none')
  })

  test('should have file format for agents', () => {
    const spec = COPILOT_INSTALL_SPECS.agents
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('none')
  })

  test('should have file format for commands', () => {
    const spec = COPILOT_INSTALL_SPECS.commands
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('none')
  })

  test('should have section format for workflows', () => {
    const spec = COPILOT_INSTALL_SPECS.workflows
    expect(spec.format).toBe('section')
    expect(spec.configUpdate).toBe('none')
  })

  test('should have file format for templates', () => {
    const spec = COPILOT_INSTALL_SPECS.templates
    expect(spec.format).toBe('file')
    expect(spec.configUpdate).toBe('none')
  })

  test('should compute correct content paths', () => {
    const rulesPath = COPILOT_INSTALL_SPECS.rules.contentPath('/project', 'rules', 'my-rule')
    expect(rulesPath).toBe('/project/.github/copilot-instructions.md')

    const skillsPath = COPILOT_INSTALL_SPECS.skills.contentPath('/project', 'skills', 'my-skill')
    expect(skillsPath).toBe('/project/.github/skills/my-skill.md')

    const agentsPath = COPILOT_INSTALL_SPECS.agents.contentPath('/project', 'agents', 'my-agent')
    expect(agentsPath).toBe('/project/.github/agents/my-agent.md')

    const commandsPath = COPILOT_INSTALL_SPECS.commands.contentPath(
      '/project',
      'commands',
      'my-cmd'
    )
    expect(commandsPath).toBe('/project/.github/commands/my-cmd.md')

    const workflowsPath = COPILOT_INSTALL_SPECS.workflows.contentPath(
      '/project',
      'workflows',
      'my-wf'
    )
    expect(workflowsPath).toBe('/project/.github/copilot-instructions.md')

    const templatesPath = COPILOT_INSTALL_SPECS.templates.contentPath(
      '/project',
      'templates',
      'my-tpl'
    )
    expect(templatesPath).toBe('/project/.github/templates/my-tpl.md')
  })
})

describe('COPILOT_CONFIG', () => {
  test('should reference COPILOT_AGENT', () => {
    expect(COPILOT_CONFIG.agent).toBe(COPILOT_AGENT)
  })

  test('should reference COPILOT_INSTALL_SPECS', () => {
    expect(COPILOT_CONFIG.installSpecs).toBe(COPILOT_INSTALL_SPECS)
  })

  test('should not have instructionsCategories', () => {
    expect(COPILOT_CONFIG.instructionsCategories).toBeUndefined()
  })
})
