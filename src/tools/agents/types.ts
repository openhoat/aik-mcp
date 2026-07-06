// Supported agent types
export type Agent = 'opencode' | 'claude-code' | 'cline' | 'codex' | 'copilot'

// Content category types
export type Category = 'rules' | 'skills' | 'workflows' | 'agents' | 'commands' | 'templates'

// Possible installation formats
export type InstallFormat = 'file' | 'directory-skill' | 'section'

// Config update strategy per agent
export type ConfigUpdate =
  | 'none'
  | 'opencode-instructions'
  | 'claude-md-section'
  | 'codex-agents-md'

// Agent-specific configuration
export interface AgentSpec {
  name: Agent
  displayName: string
  configPath: (projectDir: string) => string
  detectionPatterns: Array<(dir: string) => boolean>
  detectionPriority: number // Higher priority = detected first
}

// Installation specification for a category
export interface InstallSpec {
  format: InstallFormat
  contentPath: (projectDir: string, category: string, name: string) => string
  configUpdate: ConfigUpdate
}

// Complete agent configuration
export interface AgentConfig {
  agent: AgentSpec
  installSpecs: Record<Category, InstallSpec>
  instructionsCategories?: Category[] // For opencode.jsonc
}

// Agent detection result and found configuration
export interface AgentDetection {
  agent: Agent
  path: string
  priority: number
}
