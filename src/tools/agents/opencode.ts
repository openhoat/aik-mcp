import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, InstallSpec } from './types.js'

export const OPENCODE_AGENT: AgentSpec = {
  name: 'opencode',
  displayName: 'OpenCode',
  configPath: dir => join(dir, '.opencode', 'opencode.jsonc'),
  globalBaseDir: () => join(homedir(), '.config', 'opencode'),
  detectionPatterns: [],
  detectionPriority: 1,
}

export const OPENCODE_INSTALL_SPECS: Record<Category, InstallSpec> = {
  rules: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.opencode', 'rules', `${name}.md`),
    configUpdate: 'opencode-instructions',
  },
  skills: {
    format: 'directory-skill',
    contentPath: (dir, _cat, name) => join(dir, '.opencode', 'skills', name, 'SKILL.md'),
    configUpdate: 'none',
  },
  agents: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.opencode', cat, `${name}.md`),
    configUpdate: 'none',
  },
  commands: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.opencode', cat, `${name}.md`),
    configUpdate: 'none',
  },
  workflows: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.opencode', cat, `${name}.md`),
    configUpdate: 'opencode-instructions',
  },
  templates: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.opencode', cat, `${name}.md`),
    configUpdate: 'opencode-instructions',
  },
}

export const OPENCODE_GLOBAL_INSTALL_SPECS: Record<Category, InstallSpec> = {
  rules: {
    format: 'section',
    contentPath: (dir, _cat, _name) => join(dir, 'AGENTS.md'),
    configUpdate: 'none',
  },
  skills: {
    format: 'directory-skill',
    contentPath: (dir, _cat, name) => join(dir, 'skills', name, 'SKILL.md'),
    configUpdate: 'none',
  },
  agents: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, cat, `${name}.md`),
    configUpdate: 'none',
  },
  commands: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, cat, `${name}.md`),
    configUpdate: 'none',
  },
  workflows: {
    format: 'section',
    contentPath: (dir, _cat, _name) => join(dir, 'AGENTS.md'),
    configUpdate: 'none',
  },
  templates: {
    format: 'section',
    contentPath: (dir, _cat, _name) => join(dir, 'AGENTS.md'),
    configUpdate: 'none',
  },
}

export const OPENCODE_CONFIG: AgentConfig = {
  agent: OPENCODE_AGENT,
  installSpecs: OPENCODE_INSTALL_SPECS,
  globalInstallSpecs: OPENCODE_GLOBAL_INSTALL_SPECS,
  instructionsCategories: ['rules', 'workflows', 'templates'],
}
