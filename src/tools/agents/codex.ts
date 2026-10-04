import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, Layout, LayoutEntry } from './types.js'

export const CODEX_AGENT: AgentSpec = {
  name: 'codex',
  displayName: 'Codex',
  configPath: dir => join(dir, '.codex'),
  globalBaseDir: () => process.env.CODEX_HOME || join(homedir(), '.codex'),
  detectionPatterns: [],
  detectionPriority: 7,
}

export const CODEX_PROJECT_LAYOUT: Record<Category, LayoutEntry> = {
  rules: { format: 'section', dir: '', file: 'AGENTS.md', configUpdate: 'none' },
  skills: {
    format: 'directory-skill',
    dir: '.codex/skills',
    file: '{name}/SKILL.md',
    configUpdate: 'none',
  },
  agents: { format: 'file', dir: '.codex/agents', file: '{name}.md', configUpdate: 'none' },
  workflows: { format: 'section', dir: '', file: 'AGENTS.md', configUpdate: 'none' },
}

// Codex global only supports rules and workflows (appended to AGENTS.md)
export const CODEX_GLOBAL_LAYOUT: Layout = {
  rules: { format: 'section', dir: '', file: 'AGENTS.md', configUpdate: 'none' },
  workflows: { format: 'section', dir: '', file: 'AGENTS.md', configUpdate: 'none' },
}

export const CODEX_CONFIG: AgentConfig = {
  agent: CODEX_AGENT,
  project: CODEX_PROJECT_LAYOUT,
  global: CODEX_GLOBAL_LAYOUT,
}
