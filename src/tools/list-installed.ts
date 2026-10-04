import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { list as engineList } from './agents/engine.js'
import { getGlobalBaseDir } from './agents/factory.js'
import type { Agent, Scope } from './shared.js'
import { findExistingConfig } from './shared.js'

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

      if (effectiveScope === 'global') {
        if (agent === 'copilot') {
          return {
            content: [{ type: 'text', text: 'Global scope is not supported for copilot' }],
            isError: true,
          }
        }
        const globalDir = getGlobalBaseDir(agent)
        const items = engineList(agent, { scope: 'global', baseDir: globalDir, configPath: null })
        if (items.length === 0) {
          return {
            content: [{ type: 'text', text: `No aik-installed items found globally for ${agent}` }],
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  agent,
                  scope: 'global',
                  config: globalDir,
                  count: items.length,
                  items: toOutput(items),
                },
                null,
                2
              ),
            },
          ],
        }
      }

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const existing = findExistingConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      const configPath = existing && existing.agent === agent ? existing.path : null
      const items = engineList(agent, { scope: 'project', baseDir: targetDir, configPath })

      if (items.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No aik-installed items found in ${agent} config (${existing.path})`,
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                agent,
                config: existing.path,
                count: items.length,
                items: toOutput(items),
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )
}
