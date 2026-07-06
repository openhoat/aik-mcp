import { CLAUDE_CODE_CONFIG } from './claude-code.js'
import { CLINE_CONFIG } from './cline.js'
import { CODEX_CONFIG } from './codex.js'
import { OPENCODE_CONFIG } from './opencode.js'
import type { Agent, AgentConfig, Category, InstallSpec } from './types.js'

// Centralized registry of agent configurations
const AGENT_CONFIGS: Record<Agent, AgentConfig> = {
  opencode: OPENCODE_CONFIG,
  'claude-code': CLAUDE_CODE_CONFIG,
  cline: CLINE_CONFIG,
  codex: CODEX_CONFIG,
}

export const getAgentConfig = (agent: Agent): AgentConfig => {
  return AGENT_CONFIGS[agent]
}

export const getInstallSpec = (agent: Agent, category: Category): InstallSpec => {
  return AGENT_CONFIGS[agent].installSpecs[category]
}

export const getInstructionsCategories = (agent: Agent): Category[] => {
  return AGENT_CONFIGS[agent].instructionsCategories ?? []
}

export const getAllAgents = (): Agent[] => {
  return Object.keys(AGENT_CONFIGS) as Agent[] // Safe: AGENT_CONFIGS keys match Agent type
}
