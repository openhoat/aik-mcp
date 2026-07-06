import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, InstallSpec } from './types.js'

export const CLINE_AGENT: AgentSpec = {
  name: 'cline',
  displayName: 'Cline',
  configPath: dir => join(dir, '.cline'),
  detectionPatterns: [],
  detectionPriority: 3,
}

export const CLINE_INSTALL_SPECS: Record<Category, InstallSpec> = {
  rules: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.clinerules', `${name}.md`),
    configUpdate: 'none',
  },
  skills: {
    format: 'directory-skill',
    contentPath: (dir, _cat, name) => join(dir, '.cline', 'skills', name, 'SKILL.md'),
    configUpdate: 'none',
  },
  agents: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.cline', cat, `${name}.md`),
    configUpdate: 'none',
  },
  commands: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.cline', cat, `${name}.md`),
    configUpdate: 'none',
  },
  workflows: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.clinerules', `${name}.md`),
    configUpdate: 'none',
  },
  templates: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.cline', cat, `${name}.md`),
    configUpdate: 'none',
  },
}

export const CLINE_CONFIG: AgentConfig = {
  agent: CLINE_AGENT,
  installSpecs: CLINE_INSTALL_SPECS,
}
