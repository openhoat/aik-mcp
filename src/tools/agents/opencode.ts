import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, LayoutEntry } from './types.js'

export const OPENCODE_AGENT: AgentSpec = {
  globalBaseDir: () => join(homedir(), '.config', 'opencode'),
  detectionPatterns: [
    { path: '.opencode/opencode.jsonc', kind: 'file' },
    { path: '.opencode/opencode.json', kind: 'file' },
    { path: 'opencode.json', kind: 'file' },
    { path: 'opencode.jsonc', kind: 'file' },
  ],
  detectionPriority: 1,
}

export const OPENCODE_PROJECT_LAYOUT: Record<Category, LayoutEntry> = {
  rules: {
    format: 'file',
    dir: '.opencode/rules',
    file: '{name}.md',
    configUpdate: 'opencode-instructions',
  },
  skills: {
    format: 'directory-skill',
    dir: '.opencode/skills',
    file: '{name}/SKILL.md',
    configUpdate: 'none',
  },
  agents: {
    format: 'file',
    dir: '.opencode/agents',
    file: '{name}.md',
    configUpdate: 'none',
  },
  workflows: {
    format: 'file',
    dir: '.opencode/workflows',
    file: '{name}.md',
    configUpdate: 'opencode-instructions',
  },
}

export const OPENCODE_GLOBAL_LAYOUT: Record<Category, LayoutEntry> = {
  rules: {
    format: 'file',
    dir: 'rules',
    file: '{name}.md',
    configUpdate: 'opencode-instructions',
  },
  skills: {
    format: 'directory-skill',
    dir: 'skills',
    file: '{name}/SKILL.md',
    configUpdate: 'none',
  },
  agents: {
    format: 'file',
    dir: 'agents',
    file: '{name}.md',
    configUpdate: 'none',
  },
  workflows: {
    format: 'file',
    dir: 'workflows',
    file: '{name}.md',
    configUpdate: 'opencode-instructions',
  },
}

export const OPENCODE_CONFIG: AgentConfig = {
  agent: OPENCODE_AGENT,
  project: OPENCODE_PROJECT_LAYOUT,
  global: OPENCODE_GLOBAL_LAYOUT,
}
