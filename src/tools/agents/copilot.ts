import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, InstallSpec } from './types.js'

export const COPILOT_AGENT: AgentSpec = {
  name: 'copilot',
  displayName: 'GitHub Copilot',
  configPath: dir => join(dir, '.github', 'copilot-instructions.md'),
  detectionPatterns: [],
  detectionPriority: 12,
}

export const COPILOT_INSTALL_SPECS: Record<Category, InstallSpec> = {
  rules: {
    format: 'section',
    contentPath: (dir, _cat, _name) => join(dir, '.github', 'copilot-instructions.md'),
    configUpdate: 'none',
  },
  skills: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.github', 'skills', `${name}.md`),
    configUpdate: 'none',
  },
  agents: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.github', cat, `${name}.md`),
    configUpdate: 'none',
  },
  commands: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.github', cat, `${name}.md`),
    configUpdate: 'none',
  },
  workflows: {
    format: 'section',
    contentPath: (dir, _cat, _name) => join(dir, '.github', 'copilot-instructions.md'),
    configUpdate: 'none',
  },
  templates: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.github', cat, `${name}.md`),
    configUpdate: 'none',
  },
}

export const COPILOT_CONFIG: AgentConfig = {
  agent: COPILOT_AGENT,
  installSpecs: COPILOT_INSTALL_SPECS,
}
