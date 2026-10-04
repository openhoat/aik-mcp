import { join } from 'node:path'
import { CLAUDE_CODE_CONFIG } from './claude-code.js'
import { CLINE_CONFIG } from './cline.js'
import { CODEX_CONFIG } from './codex.js'
import { COPILOT_CONFIG } from './copilot.js'
import { OPENCODE_CONFIG } from './opencode.js'
import type {
  Agent,
  AgentConfig,
  Category,
  InstallSpec,
  Layout,
  LayoutEntry,
  Scope,
} from './types.js'
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

export const getAllAgents = (): Agent[] => {
  return Object.keys(AGENT_CONFIGS) as Agent[] // Safe: AGENT_CONFIGS keys match Agent type
}

const layoutFor = (agent: Agent, scope: Scope): Layout =>
  scope === 'project' ? AGENT_CONFIGS[agent].project : (AGENT_CONFIGS[agent].global ?? {})

// The layout entry for a category in a scope, or a throw when the category is
// unsupported there. Capability is derived from the layout, never declared twice.
export const getLayoutEntry = (agent: Agent, category: Category, scope: Scope): LayoutEntry => {
  const entry = layoutFor(agent, scope)[category]
  if (!entry) {
    throw new Error(
      `Category "${category}" is not supported for ${scope} scope with agent "${agent}"`
    )
  }
  return entry
}

export const getSupportedCategories = (agent: Agent, scope: Scope): Category[] => {
  const layout = layoutFor(agent, scope)
  return CATEGORIES.filter(category => category in layout)
}

// Resolve the file or directory a layout entry points at for one item.
export const resolveContentFile = (entry: LayoutEntry, baseDir: string, name: string): string => {
  return join(baseDir, entry.dir, entry.file.replaceAll('{name}', name))
}

export const getGlobalBaseDir = (agent: Agent): string => {
  return AGENT_CONFIGS[agent].agent.globalBaseDir()
}

// --- Compatibility shims ---------------------------------------------------
// Kept only while the tools still call the pre-engine helpers. Removed once
// every tool goes through the engine.

const toInstallSpec = (entry: LayoutEntry): InstallSpec => ({
  format: entry.format,
  contentPath: (baseDir, _category, name) => resolveContentFile(entry, baseDir, name),
  configUpdate: entry.configUpdate,
})

export const getInstallSpec = (agent: Agent, category: Category): InstallSpec => {
  return toInstallSpec(getLayoutEntry(agent, category, 'project'))
}

export const getInstallSpecForScope = (
  agent: Agent,
  category: Category,
  scope: Scope
): InstallSpec => {
  return toInstallSpec(getLayoutEntry(agent, category, scope))
}

export const validateGlobalSupported = (agent: Agent, category: Category): void => {
  getLayoutEntry(agent, category, 'global')
}

export const getGlobalSupportedCategories = (agent: Agent): Category[] => {
  return getSupportedCategories(agent, 'global')
}

export const getInstructionsCategories = (agent: Agent): Category[] => {
  return CATEGORIES.filter(
    category => AGENT_CONFIGS[agent].project[category]?.configUpdate === 'opencode-instructions'
  )
}
