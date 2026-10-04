import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { list as engineList } from './agents/engine.js'
import { type Agent, getGlobalBaseDir } from './agents/factory.js'
import {
  errorResult,
  globalUnsupported,
  jsonResult,
  resolveProjectContext,
  textResult,
} from './agents/toolkit.js'
import type { Scope } from './agents/types.js'

const toOutput = (items: Array<{ path: string; title: string | null }>) =>
  items.map(item => ({ path: item.path, ...(item.title ? { title: item.title } : {}) }))

export const registerListInstalledTool = (server: McpServer, _store: ContentStore): void => {
  server.registerTool(
    'list_installed',
    {
      description:
        'List all aik-installed content items in the current project config. Supports opencode, Claude Code, Cline, and Codex.',
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
          .describe('Scope to list (project or global).'),
      },
    },
    async ({ projectDir, agent, scope }: { projectDir?: string; agent: Agent; scope?: Scope }) => {
      logger.trace({ projectDir, agent, scope }, 'list_installed called')
      const effectiveScope = scope ?? 'project'
      const globalBlocked = globalUnsupported(agent, effectiveScope)
      if (globalBlocked) return globalBlocked

      if (effectiveScope === 'global') {
        const globalDir = getGlobalBaseDir(agent)
        const items = engineList(agent, { scope: 'global', baseDir: globalDir, configPath: null })
        if (items.length === 0) {
          return textResult(`No aik-installed items found globally for ${agent}`)
        }
        return jsonResult({
          agent,
          scope: 'global',
          config: globalDir,
          count: items.length,
          items: toOutput(items),
        })
      }

      const project = resolveProjectContext(agent, projectDir)
      if (!project) return errorResult('No config file found for the detected agent')

      const items = engineList(agent, project.context)
      if (items.length === 0) {
        return textResult(
          `No aik-installed items found in ${agent} config (${project.detectedPath})`
        )
      }
      return jsonResult({
        agent,
        config: project.detectedPath,
        count: items.length,
        items: toOutput(items),
      })
    }
  )
}
