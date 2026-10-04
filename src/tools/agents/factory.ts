import { join } from 'node:path'
import { CLAUDE_CODE_CONFIG } from './claude-code.js'
import { CLINE_CONFIG } from './cline.js'
import { CODEX_CONFIG } from './codex.js'
import { COPILOT_CONFIG } from './copilot.js'
import { OPENCODE_CONFIG } from './opencode.js'
import type { AgentConfig, Category, Layout, LayoutEntry, Scope } from './types.js'
import { CATEGORIES } from './types.js'

// Centralized registry of agent configurations. The Agent type is derived from
// it, so adding an agent here is the single change that widens the type.
export const AGENT_CONFIGS = {
  opencode: OPENCODE_CONFIG,
  'claude-code': CLAUDE_CODE_CONFIG,
  cline: CLINE_CONFIG,
  codex: CODEX_CONFIG,
  copilot: COPILOT_CONFIG,
} satisfies Record<string, AgentConfig>

export type Agent = keyof typeof AGENT_CONFIGS

export const getAgentConfig = (agent: Agent): AgentConfig => {
  return AGENT_CONFIGS[agent]
}

export const getAllAgents = (): Agent[] => {
  return Object.keys(AGENT_CONFIGS) as Agent[]
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
