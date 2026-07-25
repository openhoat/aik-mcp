import { CLAUDE_CODE_CONFIG } from './claude-code.js'
import { CLINE_CONFIG } from './cline.js'
import { CODEX_CONFIG } from './codex.js'
import { COPILOT_CONFIG } from './copilot.js'
import { OPENCODE_CONFIG } from './opencode.js'
import type { Agent, AgentConfig, Category, InstallSpec, Scope } from './types.js'
import { CATEGORIES } from './types.js'

// Centralized registry of agent configurations
const AGENT_CONFIGS: Record<Agent, AgentConfig> = {
  opencode: OPENCODE_CONFIG,
  'claude-code': CLAUDE_CODE_CONFIG,
  cline: CLINE_CONFIG,
  codex: CODEX_CONFIG,
  copilot: COPILOT_CONFIG,
}

export const getAgentConfig = (agent: Agent): AgentConfig => {
  return AGENT_CONFIGS[agent]
}

export const getInstallSpec = (agent: Agent, category: Category): InstallSpec => {
  return AGENT_CONFIGS[agent].installSpecs[category]
}

export const getInstallSpecForScope = (
  agent: Agent,
  category: Category,
  scope: Scope
): InstallSpec => {
  if (scope === 'project') return getInstallSpec(agent, category)
  const config = AGENT_CONFIGS[agent]
  const globalSpec = config.globalInstallSpecs?.[category]
  if (!globalSpec) {
    throw new Error(
      `Category "${category}" is not supported for global scope with agent "${agent}"`
    )
  }
  return globalSpec
}

export const getGlobalBaseDir = (agent: Agent): string => {
  return AGENT_CONFIGS[agent].agent.globalBaseDir()
}

export const validateGlobalSupported = (agent: Agent, category: Category): void => {
  const config = AGENT_CONFIGS[agent]
  const spec = config.globalInstallSpecs?.[category]
  if (!spec) {
    throw new Error(
      `Global scope is not supported for ${agent} category "${category}". ` +
        `Supported categories: ${Object.keys(config.globalInstallSpecs ?? {}).join(', ') || '(none)'}`
    )
  }
}

export const getGlobalSupportedCategories = (agent: Agent): Category[] => {
  const config = AGENT_CONFIGS[agent]
  const specs = config.globalInstallSpecs
  if (!specs) return []
  return (CATEGORIES as Category[]).filter(c => c in specs)
}

export const getInstructionsCategories = (agent: Agent): Category[] => {
  return AGENT_CONFIGS[agent].instructionsCategories ?? []
}

export const getAllAgents = (): Agent[] => {
  return Object.keys(AGENT_CONFIGS) as Agent[] // Safe: AGENT_CONFIGS keys match Agent type
}
