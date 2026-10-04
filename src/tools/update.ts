import { dirname } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import {
  type EngineContext,
  install as engineInstall,
  readVersion as engineReadVersion,
  uninstall as engineUninstall,
} from './agents/engine.js'
import { type Agent, getGlobalBaseDir, getSupportedCategories } from './agents/factory.js'
import {
  contextFor,
  errorResult,
  globalUnsupported,
  itemFor,
  jsonResult,
  resolveProjectContext,
} from './agents/toolkit.js'
import type { Scope } from './agents/types.js'

export const parseSemver = (version: string): number[] => {
  return version.split('.').map(Number)
}

export const isNewer = (storeVersion: string, installedVersion: string): boolean => {
  const store = parseSemver(storeVersion)
  const installed = parseSemver(installedVersion)
  for (let i = 0; i < Math.max(store.length, installed.length); i++) {
    const s = store[i] ?? 0
    const inst = installed[i] ?? 0
    if (s > inst) return true
    if (s < inst) return false
  }
  return false
}

const resolveUpdateContext = (
  agent: Agent,
  effectiveScope: Scope,
  projectDir?: string
): EngineContext | null => {
  if (effectiveScope === 'global') {
    return contextFor('global', getGlobalBaseDir(agent), null)
  }
  return resolveProjectContext(agent, projectDir)?.context ?? null
}

interface UpdateInfo {
  path: string
  installedVersion: string | null
  storeVersion: string
}

const collectUpdates = (
  agent: Agent,
  effectiveScope: Scope,
  context: EngineContext,
  store: ContentStore
): UpdateInfo[] => {
  const updates: UpdateInfo[] = []

  for (const category of getSupportedCategories(agent, effectiveScope)) {
    for (const storeItem of store.getByCategory(category)) {
      const installedVersion = engineReadVersion(
        agent,
        itemFor(category, storeItem.name, storeItem.path),
        context
      )
      if (installedVersion === null) continue
      if (isNewer(storeItem.version, installedVersion)) {
        updates.push({ path: storeItem.path, installedVersion, storeVersion: storeItem.version })
      }
    }
  }
  return updates
}

interface CheckContext {
  context: EngineContext
  configLabel: string
}

const resolveCheckContext = (
  agent: Agent,
  effectiveScope: Scope,
  projectDir?: string
): CheckContext | null => {
  if (effectiveScope === 'global') {
    const baseDir = getGlobalBaseDir(agent)
    return { context: contextFor('global', baseDir, null), configLabel: baseDir }
  }

  const project = resolveProjectContext(agent, projectDir)
  if (!project) return null
  return { context: project.context, configLabel: project.detectedPath }
}

export const registerCheckUpdatesTool = (server: McpServer, store: ContentStore): void => {
  server.registerTool(
    'check_updates',
    {
      description:
        'Check for installed content items that have newer versions available in the knowledge base.',
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
          .describe('Scope to check (project or global).'),
      },
    },
    async ({ projectDir, agent, scope }: { projectDir?: string; agent: Agent; scope?: Scope }) => {
      logger.trace({ projectDir, agent, scope }, 'check_updates called')
      const effectiveScope = scope ?? 'project'
      const globalBlocked = globalUnsupported(agent, effectiveScope)
      if (globalBlocked) return globalBlocked

      const resolved = resolveCheckContext(agent, effectiveScope, projectDir)
      if (!resolved) return errorResult('No config file found for the detected agent')

      const updates = collectUpdates(agent, effectiveScope, resolved.context, store)

      return jsonResult({
        agent,
        scope: effectiveScope,
        config: resolved.configLabel,
        updateCount: updates.length,
        updates: updates.map(u => ({
          path: u.path,
          installedVersion: u.installedVersion ?? '(unknown)',
          storeVersion: u.storeVersion,
        })),
      })
    }
  )
}

export const registerUpdateTool = (server: McpServer, store: ContentStore): void => {
  server.registerTool(
    'update',
    {
      description:
        'Update a previously installed content item if a newer version is available in the knowledge base. Supports opencode, Claude Code, and Cline.',
      inputSchema: {
        path: z.string().describe('Path of the content to update (e.g. "rules/typescript")'),
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
          .describe('Update scope (project or global).'),
      },
    },
    async ({
      path,
      projectDir,
      agent,
      scope,
    }: {
      path: string
      projectDir?: string
      agent: Agent
      scope?: Scope
    }) => {
      logger.trace({ path, projectDir, agent, scope }, 'update called')
      const effectiveScope = scope ?? 'project'
      const globalBlocked = globalUnsupported(agent, effectiveScope)
      if (globalBlocked) return globalBlocked

      const storeItem = store.getByPath(path)
      if (!storeItem) return errorResult(`Content not found: ${path}`)

      const context = resolveUpdateContext(agent, effectiveScope, projectDir)
      if (!context) return errorResult('No config file found for the detected agent')

      const item = itemFor(storeItem.category, storeItem.name, storeItem.path)
      const installedVersion = engineReadVersion(agent, item, context)

      if (installedVersion && !isNewer(storeItem.version, installedVersion)) {
        return jsonResult({
          path,
          status: 'already-up-to-date',
          scope: effectiveScope,
          installedVersion,
          storeVersion: storeItem.version,
        })
      }

      const rawContent = store.readContent(storeItem.path) ?? storeItem.content
      const uninstalled = engineUninstall(agent, item, context)

      engineInstall(
        agent,
        { ...item, title: storeItem.title, rawContent, sourceDir: dirname(storeItem.fullPath) },
        context
      )

      return jsonResult({
        updated: path,
        agent,
        scope: effectiveScope,
        previousVersion: installedVersion ?? '(unknown)',
        newVersion: storeItem.version,
        hadPreviousInstall: uninstalled,
        config: context.configPath ?? context.baseDir,
      })
    }
  )
}
