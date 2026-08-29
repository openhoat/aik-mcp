import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Category, ContentStore } from '../content-store.js'
import { parseFrontmatter } from '../frontmatter.js'
import { logger } from '../logger.js'
import { getInstallSpecForScope } from './agents/factory.js'
import { installContent } from './install.js'
import type { Agent, Scope } from './shared.js'
import { findExistingConfig, resolveGlobalDir } from './shared.js'
import { uninstallContent } from './uninstall.js'

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

const getInstalledVersionForSpec = (
  agent: Agent,
  category: Category,
  name: string,
  baseDir: string,
  scope: Scope = 'project'
): string | null => {
  const spec = getInstallSpecForScope(agent, category, scope)
  const targetFile = spec.contentPath(baseDir, category, name)

  // Only file and directory-skill formats are used after refactoring
  if (spec.format !== 'file' && spec.format !== 'directory-skill') {
    return null
  }

  if (!existsSync(targetFile)) return null
  try {
    const raw = readFileSync(targetFile, 'utf-8')
    return parseFrontmatter(raw).frontmatter.version || null
  } catch {
    return null
  }
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

      let baseDir: string
      let configLabel: string

      if (effectiveScope === 'global') {
        if (agent === 'copilot') {
          return {
            content: [{ type: 'text', text: 'Global scope is not supported for copilot' }],
            isError: true,
          }
        }
        baseDir = resolveGlobalDir(agent)
        configLabel = baseDir
      } else {
        const targetDir = projectDir ? resolve(projectDir) : process.cwd()
        const existing = findExistingConfig(targetDir)
        if (!existing) {
          return {
            content: [{ type: 'text', text: 'No config file found for the detected agent' }],
            isError: true,
          }
        }
        baseDir = targetDir
        configLabel = existing.path
      }

      const categories: Category[] = ['rules', 'skills', 'workflows', 'agents']
      const updates: Array<{
        path: string
        installedVersion: string | null
        storeVersion: string
      }> = []

      for (const category of categories) {
        const storeItems = store.getByCategory(category)
        for (const storeItem of storeItems) {
          const installedVersion = getInstalledVersionForSpec(
            agent,
            category,
            storeItem.name,
            baseDir,
            effectiveScope
          )
          if (installedVersion === null) continue
          if (isNewer(storeItem.version, installedVersion)) {
            updates.push({
              path: storeItem.path,
              installedVersion,
              storeVersion: storeItem.version,
            })
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                agent,
                scope: effectiveScope,
                config: configLabel,
                updateCount: updates.length,
                updates: updates.map(u => ({
                  path: u.path,
                  installedVersion: u.installedVersion ?? '(unknown)',
                  storeVersion: u.storeVersion,
                })),
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

      if (effectiveScope === 'global' && agent === 'copilot') {
        return {
          content: [{ type: 'text', text: 'Global scope is not supported for copilot' }],
          isError: true,
        }
      }

      const storeItem = store.getByPath(path)
      if (!storeItem) {
        return {
          content: [{ type: 'text', text: `Content not found: ${path}` }],
          isError: true,
        }
      }

      let baseDir: string
      let configPath: string | null

      if (effectiveScope === 'global') {
        baseDir = resolveGlobalDir(agent)
        configPath = null
      } else {
        const targetDir = projectDir ? resolve(projectDir) : process.cwd()
        const existing = findExistingConfig(targetDir)
        if (!existing) {
          return {
            content: [{ type: 'text', text: 'No config file found for the detected agent' }],
            isError: true,
          }
        }
        baseDir = targetDir
        configPath = existing.agent === agent ? existing.path : null
      }

      const installedVersion = getInstalledVersionForSpec(
        agent,
        storeItem.category,
        storeItem.name,
        baseDir,
        effectiveScope
      )

      if (installedVersion && !isNewer(storeItem.version, installedVersion)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  path,
                  status: 'already-up-to-date',
                  scope: effectiveScope,
                  installedVersion,
                  storeVersion: storeItem.version,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      const rawContent = readFileSync(storeItem.fullPath, 'utf-8')
      const uninstalled = uninstallContent(
        agent,
        storeItem.category,
        storeItem.name,
        path,
        baseDir,
        configPath,
        effectiveScope
      )

      installContent(
        agent,
        storeItem.category,
        storeItem.name,
        storeItem.path,
        storeItem.title,
        rawContent,
        baseDir,
        configPath,
        effectiveScope,
        dirname(storeItem.fullPath)
      )

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                updated: path,
                agent,
                scope: effectiveScope,
                previousVersion: installedVersion ?? '(unknown)',
                newVersion: storeItem.version,
                hadPreviousInstall: uninstalled,
                config: configPath ?? baseDir,
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
