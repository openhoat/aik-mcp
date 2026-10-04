import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, LayoutEntry } from './types.js'

export const COPILOT_AGENT: AgentSpec = {
  name: 'copilot',
  displayName: 'GitHub Copilot',
  configPath: dir => join(dir, '.github', 'copilot-instructions.md'),
  globalBaseDir: () => join(homedir(), '.github'),
  detectionPatterns: [],
  detectionPriority: 12,
}

export const COPILOT_PROJECT_LAYOUT: Record<Category, LayoutEntry> = {
  rules: {
    format: 'section',
    dir: '.github',
    file: 'copilot-instructions.md',
    configUpdate: 'none',
  },
  skills: { format: 'file', dir: '.github/skills', file: '{name}.md', configUpdate: 'none' },
  agents: { format: 'file', dir: '.github/agents', file: '{name}.md', configUpdate: 'none' },
  workflows: {
    format: 'section',
    dir: '.github',
    file: 'copilot-instructions.md',
    configUpdate: 'none',
  },
}

// Copilot does not support global scope
export const COPILOT_CONFIG: AgentConfig = {
  agent: COPILOT_AGENT,
  project: COPILOT_PROJECT_LAYOUT,
}
