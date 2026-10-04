// Supported agent types
export type Agent = 'opencode' | 'claude-code' | 'cline' | 'codex' | 'copilot'

// Content category types
export type Category = 'rules' | 'skills' | 'workflows' | 'agents'

// Installation scope
export type Scope = 'project' | 'global'

// Possible installation formats
export type InstallFormat = 'file' | 'directory-skill' | 'section'

// Config update strategy per agent
export type ConfigUpdate = 'none' | 'opencode-instructions'

export const CATEGORIES: Category[] = ['rules', 'skills', 'workflows', 'agents']

// A declarative description of where one category's content lives in one scope.
export interface LayoutEntry {
  format: InstallFormat
  // Directory relative to the scope base directory. Empty string means the base
  // directory itself (used by shared-section files and flat rule directories).
  dir: string
  // Filename template. `{name}` is interpolated per item; a literal is a shared file.
  file: string
  configUpdate: ConfigUpdate
}

// Per-scope layout: a category absent from the map is unsupported in that scope.
export type Layout = Partial<Record<Category, LayoutEntry>>

// Agent-specific configuration
export interface AgentSpec {
  name: Agent
  displayName: string
  configPath: (projectDir: string) => string
  globalBaseDir: () => string
  detectionPatterns: Array<(dir: string) => boolean>
  detectionPriority: number // Higher priority = detected first
}

// Installation specification for a category
export interface InstallSpec {
  format: InstallFormat
  contentPath: (baseDir: string, category: string, name: string) => string
  configUpdate: ConfigUpdate
}

// Complete agent configuration: a project layout and an optional global layout.
// Every agent defines all four categories for the project scope.
export interface AgentConfig {
  agent: AgentSpec
  project: Record<Category, LayoutEntry>
  global?: Layout
}

// Agent detection result and found configuration
export interface AgentDetection {
  agent: Agent
  path: string
  priority: number
}
