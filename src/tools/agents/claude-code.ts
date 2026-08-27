import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, InstallSpec } from './types.js'

export const CLAUDE_CODE_AGENT: AgentSpec = {
  name: 'claude-code',
  displayName: 'Claude Code',
  configPath: dir => join(dir, '.claude'),
  globalBaseDir: () => join(homedir(), '.claude'),
  detectionPatterns: [],
  detectionPriority: 2,
}

export const CLAUDE_CODE_INSTALL_SPECS: Record<Category, InstallSpec> = {
  rules: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.claude', 'rules', `${name}.md`),
    configUpdate: 'none',
  },
  skills: {
    format: 'directory-skill',
    contentPath: (dir, _cat, name) => join(dir, '.claude', 'skills', name, 'SKILL.md'),
    configUpdate: 'none',
  },
  agents: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.claude', 'agents', `${name}.md`),
    configUpdate: 'none',
  },
  commands: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.claude', 'commands', `${name}.md`),
    configUpdate: 'none',
  },
  workflows: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.claude', 'workflows', `${name}.md`),
    configUpdate: 'none',
  },
  templates: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.claude', 'templates', `${name}.md`),
    configUpdate: 'none',
  },
}

// Global: same as project but uses ~/.claude base
export const CLAUDE_CODE_GLOBAL_INSTALL_SPECS: Record<Category, InstallSpec> = {
  rules: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, 'rules', `${name}.md`),
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
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, 'workflows', `${name}.md`),
    configUpdate: 'none',
  },
  templates: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, cat, `${name}.md`),
    configUpdate: 'none',
  },
}

export const CLAUDE_CODE_CONFIG: AgentConfig = {
  agent: CLAUDE_CODE_AGENT,
  installSpecs: CLAUDE_CODE_INSTALL_SPECS,
  globalInstallSpecs: CLAUDE_CODE_GLOBAL_INSTALL_SPECS,
}
