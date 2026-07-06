// Types d'agents supportés
export type Agent = 'opencode' | 'claude-code' | 'cline'

// Types de catégories de contenu
export type Category = 'rules' | 'skills' | 'workflows' | 'agents' | 'commands' | 'templates'

// Formats d'installation possibles
export type InstallFormat = 'file' | 'directory-skill' | 'section'

// Types de mises à jour de configuration
export type ConfigUpdate = 'none' | 'opencode-instructions' | 'claude-md-section'

// Configuration spécifique à un agent
export interface AgentSpec {
  name: Agent
  displayName: string
  configPath: (projectDir: string) => string
  detectionPatterns: Array<(dir: string) => boolean>
  detectionPriority: number // Plus prioritaire = détecté en premier
}

// Spécification d'installation pour une catégorie
export interface InstallSpec {
  format: InstallFormat
  contentPath: (projectDir: string, category: string, name: string) => string
  configUpdate: ConfigUpdate
}

// Configuration complète d'un agent
export interface AgentConfig {
  agent: AgentSpec
  installSpecs: Record<Category, InstallSpec>
  instructionsCategories?: Category[] // Pour opencode.jsonc
}

// Détection d'agent et configuration trouvée
export interface AgentDetection {
  agent: Agent
  path: string
  priority: number
}
