import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Category, ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { findAgentConfig } from './agents/detection.js'
import {
  type EngineContext,
  type EngineItem,
  uninstall as engineUninstall,
  uninstallAll as engineUninstallAll,
} from './agents/engine.js'
import { type Agent, getGlobalBaseDir, getSupportedCategories } from './agents/factory.js'
import type { Scope } from './agents/types.js'

const validCategories: Category[] = ['rules', 'skills', 'workflows', 'agents']

const contextFor = (scope: Scope, baseDir: string, configPath: string | null): EngineContext => ({
  scope,
  baseDir,
  configPath,
})

const itemFor = (category: Category, name: string, itemPath: string): EngineItem => ({
  path: itemPath,
  category,
  name,
  title: '',
  rawContent: '',
})

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
      logger.trace({ path, projectDir, agent, scope }, 'uninstall called')
      const effectiveScope = scope ?? 'project'

      const [rawCategory, ...rest] = path.split('/')
      const name = rest.join('/')
      const category = validCategories.find(c => c === rawCategory)
      if (!category) {
        return {
          content: [{ type: 'text', text: `Invalid category: ${rawCategory}` }],
          isError: true,
        }
      }

      if (!getSupportedCategories(agent, effectiveScope).includes(category)) {
        return {
          content: [
            {
              type: 'text',
              text: `Category "${category}" is not supported for ${effectiveScope} scope with agent "${agent}"`,
            },
          ],
          isError: true,
        }
      }

      if (effectiveScope === 'global') {
        const globalDir = getGlobalBaseDir(agent)
        const removed = engineUninstall(
          agent,
          itemFor(category, name, path),
          contextFor('global', globalDir, null)
        )
        if (!removed) {
          return {
            content: [
              { type: 'text', text: `Not found: ${path} is not installed globally in ${agent}` },
            ],
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ uninstalled: path, agent, scope: 'global' }, null, 2),
            },
          ],
        }
      }

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const existing = findAgentConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      const configPath = existing.agent === agent ? existing.path : null

      const removed = engineUninstall(
        agent,
        itemFor(category, name, path),
        contextFor('project', targetDir, configPath)
      )

      if (!removed) {
        return {
          content: [
            { type: 'text', text: `Not found: ${path} was not installed in ${agent} config` },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ uninstalled: path, agent, config: existing.path }, null, 2),
          },
        ],
      }
    }
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
    async ({ projectDir, agent, scope }: { projectDir?: string; agent: Agent; scope?: Scope }) => {
      logger.trace({ projectDir, agent, scope }, 'uninstall_all called')
      const effectiveScope = scope ?? 'project'

      if (effectiveScope === 'global') {
        if (agent === 'copilot') {
          return {
            content: [{ type: 'text', text: 'Global scope is not supported for copilot' }],
            isError: true,
          }
        }
        const globalDir = getGlobalBaseDir(agent)
        const removed = engineUninstallAll(agent, contextFor('global', globalDir, null))
        if (removed === 0) {
          return {
            content: [{ type: 'text', text: `No aik-managed items found globally for ${agent}` }],
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ uninstalledCount: removed, agent, scope: 'global' }, null, 2),
            },
          ],
        }
      }

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const existing = findAgentConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      const configPath = existing.agent === agent ? existing.path : null
      const removed = engineUninstallAll(agent, contextFor('project', targetDir, configPath))

      if (removed === 0) {
        return {
          content: [{ type: 'text', text: `No aik-managed items found in ${agent} config` }],
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { uninstalledCount: removed, agent, config: existing.path },
              null,
              2
            ),
          },
        ],
      }
    }
  )
}
