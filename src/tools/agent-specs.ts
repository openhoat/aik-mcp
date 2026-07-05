import type { Category } from '../content-store.js'
import type { Agent } from './shared.js'

export type InstallFormat = 'file' | 'directory-skill' | 'section'

export type ConfigUpdate = 'none' | 'opencode-instructions' | 'claude-md-section'

export interface InstallSpec {
  format: InstallFormat
  contentPath: (projectDir: string, category: string, name: string) => string
  configUpdate: ConfigUpdate
}

const join = (...parts: string[]): string => parts.join('/')

const opencodeSpecs: Record<Category, InstallSpec> = {
  rules: {
    format: 'file',
    contentPath: (dir, cat, name) => join(dir, '.opencode', cat, `${name}.md`),
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

const claudeCodeSpecs: Record<Category, InstallSpec> = {
  rules: {
    format: 'section',
    contentPath: dir => join(dir, 'CLAUDE.md'),
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
    contentPath: dir => join(dir, 'CLAUDE.md'),
    configUpdate: 'claude-md-section',
  },
  templates: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.claude', 'templates', `${name}.md`),
    configUpdate: 'none',
  },
}

const clineSpecs: Record<Category, InstallSpec> = {
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
    contentPath: (dir, _cat, name) => join(dir, '.cline', 'agents', `${name}.md`),
    configUpdate: 'none',
  },
  commands: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.cline', 'commands', `${name}.md`),
    configUpdate: 'none',
  },
  workflows: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.clinerules', `${name}.md`),
    configUpdate: 'none',
  },
  templates: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.cline', 'templates', `${name}.md`),
    configUpdate: 'none',
  },
}

const SPECS: Record<Agent, Record<Category, InstallSpec>> = {
  opencode: opencodeSpecs,
  'claude-code': claudeCodeSpecs,
  cline: clineSpecs,
}

export function getInstallSpec(agent: Agent, category: Category): InstallSpec {
  return SPECS[agent][category]
}

export function getOpencodeInstructionsCategories(): Category[] {
  return (Object.keys(opencodeSpecs) as Category[]).filter(
    cat => opencodeSpecs[cat].configUpdate === 'opencode-instructions'
  )
}
