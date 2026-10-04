import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Category, ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import {
  uninstall as engineUninstall,
  uninstallAll as engineUninstallAll,
} from './agents/engine.js'
import { type Agent, getGlobalBaseDir } from './agents/factory.js'
import {
  contextFor,
  errorResult,
  globalUnsupported,
  itemFor,
  jsonResult,
  resolveProjectContext,
  type ToolResult,
  textResult,
  unsupportedCategory,
} from './agents/toolkit.js'
import type { Scope } from './agents/types.js'

const validCategories: Category[] = ['rules', 'skills', 'workflows', 'agents']

interface UninstallArgs {
  path: string
  projectDir?: string
  agent: Agent
  scope?: Scope
}

interface UninstallAllArgs {
  projectDir?: string
  agent: Agent
  scope?: Scope
}

const runUninstall = ({ path, projectDir, agent, scope }: UninstallArgs): ToolResult => {
  logger.trace({ path, projectDir, agent, scope }, 'uninstall called')
  const effectiveScope = scope ?? 'project'

  const [rawCategory, ...rest] = path.split('/')
  const name = rest.join('/')
  const category = validCategories.find(c => c === rawCategory)
  if (!category) return errorResult(`Invalid category: ${rawCategory}`)

  const unsupported = unsupportedCategory(agent, effectiveScope, category)
  if (unsupported) return unsupported

  if (effectiveScope === 'global') {
    const removed = engineUninstall(
      agent,
      itemFor(category, name, path),
      contextFor('global', getGlobalBaseDir(agent), null)
    )
    if (!removed) return textResult(`Not found: ${path} is not installed globally in ${agent}`)
    return jsonResult({ uninstalled: path, agent, scope: 'global' })
  }

  const project = resolveProjectContext(agent, projectDir)
  if (!project) return errorResult('No config file found for the detected agent')

  const removed = engineUninstall(agent, itemFor(category, name, path), project.context)
  if (!removed) return textResult(`Not found: ${path} was not installed in ${agent} config`)
  return jsonResult({ uninstalled: path, agent, config: project.detectedPath })
}

const runUninstallAll = ({ projectDir, agent, scope }: UninstallAllArgs): ToolResult => {
  logger.trace({ projectDir, agent, scope }, 'uninstall_all called')
  const effectiveScope = scope ?? 'project'
  const globalBlocked = globalUnsupported(agent, effectiveScope)
  if (globalBlocked) return globalBlocked

  if (effectiveScope === 'global') {
    const removed = engineUninstallAll(agent, contextFor('global', getGlobalBaseDir(agent), null))
    if (removed === 0) return textResult(`No aik-managed items found globally for ${agent}`)
    return jsonResult({ uninstalledCount: removed, agent, scope: 'global' })
  }

  const project = resolveProjectContext(agent, projectDir)
  if (!project) return errorResult('No config file found for the detected agent')

  const removed = engineUninstallAll(agent, project.context)
  if (removed === 0) return textResult(`No aik-managed items found in ${agent} config`)
  return jsonResult({ uninstalledCount: removed, agent, config: project.detectedPath })
}

export const registerUninstallTool = (server: McpServer, _store: ContentStore): void => {
  server.registerTool(
    'uninstall',
    {
      description:
        'Uninstall a content item from the current project. Removes the file and the config reference. Supports opencode, Claude Code, Cline, and Codex.',
      inputSchema: {
        path: z.string().describe('Path of the content to uninstall (e.g. "rules/typescript")'),
        projectDir: z
          .string()
          .optional()
          .describe(
            'Project directory (defaults to current working directory). Config files are found by walking up.'
          ),
        agent: z
          .enum(['opencode', 'claude-code', 'cline', 'codex', 'copilot'])
          .describe('Target AI agent (opencode, claude-code, cline, codex, or copilot).'),
        scope: z
          .enum(['project', 'global'])
          .default('project')
          .describe('Installation scope (project or global).'),
      },
    },
    runUninstall
  )

  server.registerTool(
    'uninstall_all',
    {
      description:
        'Uninstall ALL aik-installed content items from the current project. Removes all aik-managed files and config references.',
      inputSchema: {
        projectDir: z
          .string()
          .optional()
          .describe(
            'Project directory (defaults to current working directory). Config files are found by walking up.'
          ),
        agent: z
          .enum(['opencode', 'claude-code', 'cline', 'codex', 'copilot'])
          .describe('Target AI agent (opencode, claude-code, cline, codex, or copilot).'),
        scope: z
          .enum(['project', 'global'])
          .default('project')
          .describe('Installation scope (project or global).'),
      },
    },
    runUninstallAll
  )
}
