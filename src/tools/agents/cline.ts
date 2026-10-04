import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, Layout, LayoutEntry } from './types.js'

export const CLINE_AGENT: AgentSpec = {
  name: 'cline',
  displayName: 'Cline',
  configPath: dir => join(dir, '.cline'),
  globalBaseDir: () => {
    const primary = join(homedir(), 'Documents', 'Cline', 'Rules')
    const fallback = join(homedir(), 'Cline', 'Rules')
    return existsSync(primary) ? primary : fallback
  },
  detectionPatterns: [
    { path: '.clinerules', kind: 'file' },
    { path: '.cline', kind: 'directory' },
  ],
  detectionPriority: 3,
}

export const CLINE_PROJECT_LAYOUT: Record<Category, LayoutEntry> = {
  rules: { format: 'file', dir: '.clinerules', file: '{name}.md', configUpdate: 'none' },
  skills: {
    format: 'directory-skill',
    dir: '.cline/skills',
    file: '{name}/SKILL.md',
    configUpdate: 'none',
  },
  agents: { format: 'file', dir: '.cline/agents', file: '{name}.md', configUpdate: 'none' },
  workflows: { format: 'file', dir: '.clinerules', file: '{name}.md', configUpdate: 'none' },
}

// Cline global only supports rules (single files in the Cline Rules directory)
export const CLINE_GLOBAL_LAYOUT: Layout = {
  rules: { format: 'file', dir: '', file: '{name}.md', configUpdate: 'none' },
}

export const CLINE_CONFIG: AgentConfig = {
  agent: CLINE_AGENT,
  project: CLINE_PROJECT_LAYOUT,
  global: CLINE_GLOBAL_LAYOUT,
}
