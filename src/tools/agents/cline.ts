import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentConfig, AgentSpec, Category, InstallSpec } from './types.js'

export const CLINE_AGENT: AgentSpec = {
  name: 'cline',
  displayName: 'Cline',
  configPath: dir => join(dir, '.cline'),
  globalBaseDir: () => {
    const primary = join(homedir(), 'Documents', 'Cline', 'Rules')
    const fallback = join(homedir(), 'Cline', 'Rules')
    return existsSync(primary) ? primary : fallback
  },
  detectionPatterns: [],
  detectionPriority: 3,
}

export const CLINE_INSTALL_SPECS: Record<Category, InstallSpec> = {
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
    contentPath: (dir, cat, name) => join(dir, '.cline', cat, `${name}.md`),
    configUpdate: 'none',
  },
  workflows: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, '.clinerules', `${name}.md`),
    configUpdate: 'none',
  },
}

// Cline global only supports rules (single files in Cline Rules directory)
export const CLINE_GLOBAL_INSTALL_SPECS: Partial<Record<Category, InstallSpec>> = {
  rules: {
    format: 'file',
    contentPath: (dir, _cat, name) => join(dir, `${name}.md`),
    configUpdate: 'none',
  },
}

export const CLINE_CONFIG: AgentConfig = {
  agent: CLINE_AGENT,
  installSpecs: CLINE_INSTALL_SPECS,
  globalInstallSpecs: CLINE_GLOBAL_INSTALL_SPECS,
}
