import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, InstallSpec } from './types.js'

export const CODEX_AGENT: AgentSpec = {
  name: 'codex',
  displayName: 'Codex',
  configPath: dir => join(dir, '.codex'),
  detectionPatterns: [],
  detectionPriority: 7,
}

export const CODEX_INSTALL_SPECS: Record<Category, InstallSpec> = {
  rules: {
    format: 'section',
    contentPath: (dir, _cat, _name) => join(dir, 'AGENTS.md'),
    configUpdate: 'codex-agents-md',
  },
  skills: {
    format: 'directory-skill',
    contentPath: (dir, _cat, name) => join(dir, '.codex', 'skills', name, 'SKILL.md'),
    configUpdate: 'none',
  },
  agents: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.codex', cat, `${name}.md`),
    configUpdate: 'none',
  },
  commands: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.codex', cat, `${name}.md`),
    configUpdate: 'none',
  },
  workflows: {
    format: 'section',
    contentPath: (dir, _cat, _name) => join(dir, 'AGENTS.md'),
    configUpdate: 'codex-agents-md',
  },
  templates: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.codex', cat, `${name}.md`),
    configUpdate: 'none',
  },
}

export const CODEX_CONFIG: AgentConfig = {
  agent: CODEX_AGENT,
  installSpecs: CODEX_INSTALL_SPECS,
}
