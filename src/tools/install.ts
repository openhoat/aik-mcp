import { dirname } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentItem, ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { evaluateGate } from '../project-stack.js'
import { findAgentConfig } from './agents/detection.js'
import {
  type EngineItem,
  install as engineInstall,
  uninstall as engineUninstall,
} from './agents/engine.js'
import { type Agent, getGlobalBaseDir } from './agents/factory.js'
import {
  contextFor,
  errorResult,
  itemFor,
  jsonResult,
  projectBaseDir,
  resolveProjectContext,
  textResult,
  unsupportedCategory,
} from './agents/toolkit.js'
import type { Scope } from './agents/types.js'

const engineItemFor = (store: ContentStore, item: ContentItem): EngineItem =>
  itemFor(item.category, item.name, item.path, {
    title: item.title,
    rawContent: store.readContent(item.path) ?? item.content,
    sourceDir: dirname(item.fullPath),
  })

const blockedResult = (path: string, gate: ReturnType<typeof evaluateGate>) =>
  errorResult(
    JSON.stringify(
      {
        blocked: true,
        path,
        reasons: gate.errors,
        warnings: gate.warnings,
        projectStacks: gate.projectStacks,
        mcpServers: gate.mcpServers,
        hint: 'Re-run with force: true to bypass gating.',
      },
      null,
      2
    )
  )

export const registerReinstallTool = (server: McpServer, store: ContentStore): void => {
  server.registerTool(
    'reinstall',
    {
      description:
        'Reinstall a previously installed content item. Uninstalls the old entry and installs the latest version from the knowledge base. Supports opencode, Claude Code, Cline, and Codex.',
      inputSchema: {
        path: z.string().describe('Path of the content to reinstall (e.g. "rules/typescript")'),
        projectDir: z
          .string()
          .default(process.cwd())
          .describe(
            'Project directory (defaults to current working directory). Config files are found by walking up.'
          ),
        agent: z
          .enum(['opencode', 'claude-code', 'cline', 'codex', 'copilot'])
          .describe('Target AI agent (opencode, claude-code, cline, codex, or copilot).'),
        scope: z
          .enum(['project', 'global'])
          .default('project')
          .describe(
            'Installation scope (project or global). Requires explicit agent for global scope.'
          ),
        force: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'Install even when gating fails (applies-to/requires). Use only with a documented reason.'
          ),
      },
    },
    async ({
      path,
      projectDir,
      agent,
      scope,
      force,
    }: {
      path: string
      projectDir?: string
      agent: Agent
      scope?: Scope
      force?: boolean
    }) => {
      logger.trace({ path, projectDir, agent, scope }, 'reinstall called')
      const effectiveScope = scope ?? 'project'

      const item = store.getByPath(path)
      if (!item) return errorResult(`Content not found: ${path}`)

      const unsupported = unsupportedCategory(agent, effectiveScope, item.category)
      if (unsupported) return unsupported

      const engineItem = engineItemFor(store, item)

      if (effectiveScope === 'global') {
        const context = contextFor('global', getGlobalBaseDir(agent), null)
        const uninstalled = engineUninstall(agent, engineItem, context)
        const result = engineInstall(agent, engineItem, context)
        return jsonResult({
          reinstalled: path,
          agent,
          scope: 'global',
          hadPreviousInstall: uninstalled,
          config: result.path,
        })
      }

      const project = resolveProjectContext(agent, projectDir)
      if (!project) return errorResult('No config file found for the detected agent')

      const gate = evaluateGate(
        { appliesTo: item.appliesTo, requires: item.requires },
        project.baseDir,
        {
          force: force ?? false,
        }
      )
      if (gate.blocked) return blockedResult(path, gate)

      const uninstalled = engineUninstall(agent, engineItem, project.context)
      const result = engineInstall(agent, engineItem, project.context)

      return jsonResult({
        reinstalled: path,
        agent,
        hadPreviousInstall: uninstalled,
        config: result.path,
        warnings: gate.warnings,
      })
    }
  )
}

export const registerInstallTool = (server: McpServer, store: ContentStore): void => {
  server.registerTool(
    'install',
    {
      description:
        'Install a content item (rule, skill, workflow, or agent) into the current project so it is loaded automatically in future sessions. Supports opencode, Claude Code, Cline, and Codex.',
      inputSchema: {
        path: z.string().describe('Path of the content to install (e.g. "rules/typescript")'),
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
          .describe(
            'Installation scope (project or global). Requires explicit agent for global scope.'
          ),
        force: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'Install even when gating fails (applies-to/requires). Use only with a documented reason.'
          ),
      },
    },
    async ({
      path,
      projectDir,
      agent,
      scope,
      force,
    }: {
      path: string
      projectDir?: string
      agent: Agent
      scope?: Scope
      force?: boolean
    }) => {
      logger.trace({ path, projectDir, agent, scope }, 'install called')
      const effectiveScope = scope ?? 'project'

      const item = store.getByPath(path)
      if (!item) return errorResult(`Content not found: ${path}`)

      const unsupported = unsupportedCategory(agent, effectiveScope, item.category)
      if (unsupported) return unsupported

      const engineItem = engineItemFor(store, item)

      if (effectiveScope === 'global') {
        const context = contextFor('global', getGlobalBaseDir(agent), null)
        const result = engineInstall(agent, engineItem, context)
        if (result.alreadyInstalled) {
          return textResult(`Already installed globally: ${path} in ${agent} (${result.path})`)
        }
        return jsonResult({
          installed: path,
          agent,
          scope: 'global',
          file: item.fullPath,
          config: result.path,
        })
      }

      const baseDir = projectBaseDir(projectDir)
      const existing = findAgentConfig(baseDir)
      const configPath = existing?.agent === agent ? existing.path : null

      const gate = evaluateGate({ appliesTo: item.appliesTo, requires: item.requires }, baseDir, {
        force: force ?? false,
      })
      if (gate.blocked) return blockedResult(path, gate)

      const result = engineInstall(agent, engineItem, contextFor('project', baseDir, configPath))

      if (result.alreadyInstalled) {
        return textResult(`Already installed: ${path} in ${agent} config (${result.path})`)
      }

      return jsonResult({
        installed: path,
        agent,
        file: item.fullPath,
        config: result.path,
        warnings: gate.warnings,
      })
    }
  )
}
