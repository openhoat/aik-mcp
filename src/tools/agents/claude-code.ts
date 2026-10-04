import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, LayoutEntry } from './types.js'

export const CLAUDE_CODE_AGENT: AgentSpec = {
  name: 'claude-code',
  displayName: 'Claude Code',
  configPath: dir => join(dir, '.claude'),
  globalBaseDir: () => join(homedir(), '.claude'),
  detectionPatterns: [
    { path: 'CLAUDE.md', kind: 'file' },
    { path: '.claude', kind: 'directory' },
  ],
  detectionPriority: 2,
}

export const CLAUDE_CODE_PROJECT_LAYOUT: Record<Category, LayoutEntry> = {
  rules: { format: 'file', dir: '.claude/rules', file: '{name}.md', configUpdate: 'none' },
  skills: {
    format: 'directory-skill',
    dir: '.claude/skills',
    file: '{name}/SKILL.md',
    configUpdate: 'none',
  },
  agents: { format: 'file', dir: '.claude/agents', file: '{name}.md', configUpdate: 'none' },
  workflows: {
    format: 'file',
    dir: '.claude/commands',
    file: '{name}.md',
    configUpdate: 'none',
  },
}

// Global: same shape but relative to ~/.claude
export const CLAUDE_CODE_GLOBAL_LAYOUT: Record<Category, LayoutEntry> = {
  rules: { format: 'file', dir: 'rules', file: '{name}.md', configUpdate: 'none' },
  skills: {
    format: 'directory-skill',
    dir: 'skills',
    file: '{name}/SKILL.md',
    configUpdate: 'none',
  },
  agents: { format: 'file', dir: 'agents', file: '{name}.md', configUpdate: 'none' },
  workflows: { format: 'file', dir: 'commands', file: '{name}.md', configUpdate: 'none' },
}

export const CLAUDE_CODE_CONFIG: AgentConfig = {
  agent: CLAUDE_CODE_AGENT,
  project: CLAUDE_CODE_PROJECT_LAYOUT,
  global: CLAUDE_CODE_GLOBAL_LAYOUT,
}
