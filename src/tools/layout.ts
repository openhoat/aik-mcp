import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import {
  type Agent,
  getAgentConfig,
  getAllAgents,
  getGlobalBaseHint,
  getSupportedCategories,
} from './agents/factory.js'
import type { Category, LayoutEntry, Scope } from './agents/types.js'

interface ScopeLayout {
  base: string
  categories: Partial<Record<Category, LayoutEntry>>
}

interface AgentLayout {
  agent: Agent
  project: ScopeLayout
  global: ScopeLayout | null
}

const PROJECT_BASE_HINT = 'project root (current working directory of the agent)'

const scopeLayout = (agent: Agent, scope: Scope): ScopeLayout | null => {
  const supported = getSupportedCategories(agent, scope)
  if (supported.length === 0 && scope === 'global') return null

  const categories: Partial<Record<Category, LayoutEntry>> = {}
  const config = getAgentConfig(agent)
  const layout = scope === 'global' ? (config.global ?? {}) : config.project
  for (const category of supported) {
    const entry = layout[category]
    if (entry) categories[category] = entry
  }

  return {
    base: scope === 'global' ? getGlobalBaseHint(agent) : PROJECT_BASE_HINT,
    categories,
  }
}

/**
 * The agent x scope x category tables, as data. This is the reference the
 * applying agent reads to locate an installation on its own machine: paths are
 * relative to the scope base, never absolute, so the answer is valid from any
 * host.
 */
export const buildLayoutReport = (): { version: number; agents: AgentLayout[] } => ({
  version: 1,
  agents: getAllAgents().map(agent => ({
    agent,
    project: scopeLayout(agent, 'project') ?? { base: PROJECT_BASE_HINT, categories: {} },
    global: scopeLayout(agent, 'global'),
  })),
})

export const registerLayoutTool = (server: McpServer, _store: ContentStore): void => {
  server.registerTool(
    'layout',
    {
      description:
        'Return where each AI agent (opencode, Claude Code, Cline, Codex, GitHub Copilot) installs each content category, for the project and global scopes: directory, file template, materialization format and config update. Use it to list an existing installation on your machine (inventory) or to interpret an installation plan.',
      inputSchema: {},
    },
    async () => {
      logger.trace('layout called')
      return { content: [{ type: 'text', text: JSON.stringify(buildLayoutReport(), null, 2) }] }
    }
  )
}
