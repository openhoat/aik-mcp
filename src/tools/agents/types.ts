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

// One detection probe: a path relative to the directory being walked up.
// A matching file or directory locates the agent; `report` is the config path
// surfaced to callers (defaults to the probed path).
export interface DetectionPattern {
  path: string
  kind: 'file' | 'directory'
  report?: string
}

// Agent detection metadata. The agent identity is the registry key, so it is
// not repeated here.
export interface AgentSpec {
  globalBaseDir: () => string
  detectionPatterns: DetectionPattern[]
  detectionPriority: number // Lower priority = detected first
}

// Complete agent configuration: a project layout and an optional global layout.
// Every agent defines all four categories for the project scope.
export interface AgentConfig {
  agent: AgentSpec
  project: Record<Category, LayoutEntry>
  global?: Layout
}
