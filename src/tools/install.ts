import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Category, ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { evaluateGate } from '../project-stack.js'
import { type EngineContext, type EngineItem, install as engineInstall } from './agents/engine.js'
import { getGlobalBaseDir } from './agents/factory.js'
import type { Agent, Scope } from './shared.js'
import { findExistingConfig } from './shared.js'
import { uninstallContent } from './uninstall.js'

// Thin adapter over the engine, kept while update still calls it directly.
export const installContent = (
  agent: Agent,
  category: Category,
  name: string,
  itemPath: string,
  title: string,
  rawContent: string,
  targetDir: string,
  configPath: string | null,
  scope: Scope = 'project',
  sourceDir: string | null = null
): { path: string; alreadyInstalled: boolean } => {
  return engineInstall(
    agent,
    { path: itemPath, category, name, title, rawContent, sourceDir },
    {
      scope,
      baseDir: targetDir,
      configPath,
    }
  )
}

const contextFor = (scope: Scope, baseDir: string, configPath: string | null): EngineContext => ({
  scope,
  baseDir,
  configPath,
})

const itemFor = (
  category: Category,
  name: string,
  itemPath: string,
  title: string,
  rawContent: string,
  sourceDir: string | null
): EngineItem => ({ path: itemPath, category, name, title, rawContent, sourceDir })

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
      if (!item) {
        return {
          content: [{ type: 'text', text: `Content not found: ${path}` }],
          isError: true,
        }
      }

      if (effectiveScope === 'global') {
        if (agent === 'copilot') {
          return {
            content: [{ type: 'text', text: 'Global scope is not supported for copilot' }],
            isError: true,
          }
        }
        const globalDir = getGlobalBaseDir(agent)
        const uninstalled = uninstallContent(
          agent,
          item.category,
          item.name,
          path,
          globalDir,
          null,
          'global'
        )
        const rawContent = readFileSync(item.fullPath, 'utf-8')
        const result = engineInstall(
          agent,
          itemFor(
            item.category,
            item.name,
            item.path,
            item.title,
            rawContent,
            dirname(item.fullPath)
          ),
          contextFor('global', globalDir, null)
        )
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  reinstalled: path,
                  agent,
                  scope: 'global',
                  hadPreviousInstall: uninstalled,
                  config: result.path,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()

      const gate = evaluateGate({ appliesTo: item.appliesTo, requires: item.requires }, targetDir, {
        force: force ?? false,
      })
      if (gate.blocked) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
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
              ),
            },
          ],
          isError: true,
        }
      }
      const existing = findExistingConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      const configPath = existing.agent === agent ? existing.path : null
      const uninstalled = uninstallContent(
        agent,
        item.category,
        item.name,
        path,
        targetDir,
        configPath
      )

      const rawContent = readFileSync(item.fullPath, 'utf-8')
      const result = engineInstall(
        agent,
        itemFor(
          item.category,
          item.name,
          item.path,
          item.title,
          rawContent,
          dirname(item.fullPath)
        ),
        contextFor('project', targetDir, configPath)
      )

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                reinstalled: path,
                agent,
                hadPreviousInstall: uninstalled,
                config: result.path,
                warnings: gate.warnings,
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
      if (!item) {
        return {
          content: [{ type: 'text', text: `Content not found: ${path}` }],
          isError: true,
        }
      }

      const rawContent = readFileSync(item.fullPath, 'utf-8')
      const engineItem = itemFor(
        item.category,
        item.name,
        item.path,
        item.title,
        rawContent,
        dirname(item.fullPath)
      )

      if (effectiveScope === 'global') {
        if (agent === 'copilot') {
          return {
            content: [{ type: 'text', text: 'Global scope is not supported for copilot' }],
            isError: true,
          }
        }
        const globalDir = getGlobalBaseDir(agent)
        const result = engineInstall(agent, engineItem, contextFor('global', globalDir, null))
        if (result.alreadyInstalled) {
          return {
            content: [
              {
                type: 'text',
                text: `Already installed globally: ${path} in ${agent} (${result.path})`,
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
                  installed: path,
                  agent,
                  scope: 'global',
                  file: item.fullPath,
                  config: result.path,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()

      const gate = evaluateGate({ appliesTo: item.appliesTo, requires: item.requires }, targetDir, {
        force: force ?? false,
      })
      if (gate.blocked) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
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
              ),
            },
          ],
          isError: true,
        }
      }
      const existing = findExistingConfig(targetDir)
      const configPath = existing && existing.agent === agent ? existing.path : null

      const result = engineInstall(agent, engineItem, contextFor('project', targetDir, configPath))

      if (result.alreadyInstalled) {
        return {
          content: [
            {
              type: 'text',
              text: `Already installed: ${path} in ${agent} config (${result.path})`,
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
                installed: path,
                agent,
                file: item.fullPath,
                config: result.path,
                warnings: gate.warnings,
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
