import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, InstallSpec } from './types.js'

export const CLAUDE_CODE_AGENT: AgentSpec = {
  name: 'claude-code',
  displayName: 'Claude Code',
  configPath: dir => join(dir, '.claude'),
  detectionPatterns: [],
  detectionPriority: 2,
}

export const CLAUDE_CODE_INSTALL_SPECS: Record<Category, InstallSpec> = {
  rules: {
    format: 'section',
    contentPath: (dir, _cat, _name) => join(dir, 'CLAUDE.md'),
    configUpdate: 'claude-md-section',
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
    format: 'section',
    contentPath: (dir, _cat, _name) => join(dir, 'CLAUDE.md'),
    configUpdate: 'claude-md-section',
  },
  templates: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.claude', 'templates', `${name}.md`),
    configUpdate: 'none',
  },
}

export const CLAUDE_CODE_CONFIG: AgentConfig = {
  agent: CLAUDE_CODE_AGENT,
  installSpecs: CLAUDE_CODE_INSTALL_SPECS,
}
