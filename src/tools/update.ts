import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Category, ContentStore } from '../content-store.js'
import { parseFrontmatter } from '../frontmatter.js'
import { logger } from '../logger.js'
import { getInstallSpec } from './agent-specs.js'
import { installContent } from './install.js'
import type { Agent, ToolRegistrar } from './shared.js'
import { detectAgent, findExistingConfig } from './shared.js'
import { uninstallContent } from './uninstall.js'

export function parseSemver(version: string): number[] {
  return version.split('.').map(Number)
}

export function isNewer(storeVersion: string, installedVersion: string): boolean {
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

function getInstalledVersionForSpec(
  agent: Agent,
  category: Category,
  name: string,
  projectDir: string
): string | null {
  const spec = getInstallSpec(agent, category)
  const targetFile = spec.contentPath(projectDir, category, name)

  switch (spec.format) {
    case 'file':
    case 'directory-skill': {
      if (!existsSync(targetFile)) return null
      try {
        const raw = readFileSync(targetFile, 'utf-8')
        return parseFrontmatter(raw).frontmatter.version || null
      } catch {
        return null
      }
    }
    case 'section': {
      // For section format (CLAUDE.md), we'd need to parse the section
      // This is a simplified version — sections don't reliably carry version info
      return null
    }
  }
}

export function registerCheckUpdatesTool(server: McpServer, store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'check_updates',
    'Check for installed content items that have newer versions available in the knowledge base.',
    {
      projectDir: z
        .string()
        .optional()
        .describe(
          'Project directory (defaults to current working directory). Config files are found by walking up.'
        ),
      agent: z
        .enum(['opencode', 'claude-code', 'cline'])
        .optional()
        .describe(
          'Target AI agent. Auto-detected from existing config files if not specified (opencode, claude-code, cline).'
        ),
    },
    async ({ projectDir, agent: preferredAgent }: { projectDir?: string; agent?: Agent }) => {
      logger.trace({ projectDir, agent: preferredAgent }, 'check_updates called')

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const agent = detectAgent(targetDir, preferredAgent)
      const existing = findExistingConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      const _configPath = existing.agent === agent ? existing.path : null
      const categories: Category[] = [
        'rules',
        'skills',
        'workflows',
        'agents',
        'commands',
        'templates',
      ]
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
            targetDir
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
                config: existing.path,
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

export function registerUpdateTool(server: McpServer, store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'update',
    'Update a previously installed content item if a newer version is available in the knowledge base. Supports opencode, Claude Code, and Cline.',
    {
      path: z.string().describe('Path of the content to update (e.g. "rules/typescript")'),
      projectDir: z
        .string()
        .optional()
        .describe(
          'Project directory (defaults to current working directory). Config files are found by walking up.'
        ),
      agent: z
        .enum(['opencode', 'claude-code', 'cline'])
        .optional()
        .describe(
          'Target AI agent. Auto-detected from existing config files if not specified (opencode, claude-code, cline).'
        ),
    },
    async ({
      path,
      projectDir,
      agent: preferredAgent,
    }: {
      path: string
      projectDir?: string
      agent?: Agent
    }) => {
      logger.trace({ path, projectDir, agent: preferredAgent }, 'update called')

      const storeItem = store.getByPath(path)
      if (!storeItem) {
        return {
          content: [{ type: 'text', text: `Content not found: ${path}` }],
          isError: true,
        }
      }

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const agent = detectAgent(targetDir, preferredAgent)
      const existing = findExistingConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      const configPath = existing.agent === agent ? existing.path : null
      const installedVersion = getInstalledVersionForSpec(
        agent,
        storeItem.category,
        storeItem.name,
        targetDir
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
        targetDir,
        configPath
      )

      installContent(
        agent,
        storeItem.category,
        storeItem.name,
        storeItem.path,
        storeItem.title,
        rawContent,
        targetDir,
        configPath
      )

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                updated: path,
                agent,
                previousVersion: installedVersion ?? '(unknown)',
                newVersion: storeItem.version,
                hadPreviousInstall: uninstalled,
                config: existing.path,
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
