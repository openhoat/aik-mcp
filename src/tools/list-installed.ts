import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Category, ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { getInstallSpecForScope } from './agents/factory.js'
import type { Agent, Scope } from './shared.js'
import { findExistingConfig, resolveGlobalDir } from './shared.js'

interface InstalledItem {
  path: string
  title: string | null
}

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

const listFromFileDir = (baseDir: string, category: Category): InstalledItem[] => {
  if (!isDirectory(baseDir)) return []
  const results: InstalledItem[] = []

  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const name = entry.name.replace(/\.md$/, '')
    results.push({ path: `${category}/${name}`, title: null })
  }
  return results
}

const listFromSkillDir = (baseDir: string, category: Category): InstalledItem[] => {
  if (!isDirectory(baseDir)) return []
  const results: InstalledItem[] = []

  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillFile = resolve(baseDir, entry.name, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    let title: string | null = null
    try {
      const content = readFileSync(skillFile, 'utf-8')
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (fmMatch) {
        const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m)
        const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m)
        title = nameMatch?.[1]?.trim() || descMatch?.[1]?.trim() || null
      }
    } catch {
      // ignore read errors
    }
    results.push({ path: `${category}/${entry.name}`, title })
  }
  return results
}

const listFromSections = (mdPath: string): InstalledItem[] => {
  if (!existsSync(mdPath)) return []
  const content = readFileSync(mdPath, 'utf-8')
  const results: InstalledItem[] = []
  const sectionRegex = /^## (.+)$\n(?:.|\n)*?^<source>([\w-]+\/[\w./-]+)<\/source>/gm

  for (const match of content.matchAll(sectionRegex)) {
    results.push({ path: match[2], title: match[1].trim() })
  }
  return results
}

const listInstalledForAgent = (
  agent: Agent,
  baseDir: string,
  configPath: string | null,
  scope: Scope = 'project'
): InstalledItem[] => {
  const categories: Category[] = ['rules', 'skills', 'workflows', 'agents', 'commands', 'templates']
  const results: InstalledItem[] = []

  for (const category of categories) {
    const spec = getInstallSpecForScope(agent, category, scope)

    switch (spec.format) {
      case 'file': {
        const targetDir = dirname(spec.contentPath(baseDir, category, 'placeholder'))
        results.push(...listFromFileDir(targetDir, category))
        break
      }
      case 'directory-skill': {
        const skillFile = spec.contentPath(baseDir, category, 'placeholder')
        const targetDir = dirname(dirname(skillFile))
        results.push(...listFromSkillDir(targetDir, category))
        break
      }
      case 'section': {
        const mdPath = configPath ?? spec.contentPath(baseDir, category, 'placeholder')
        results.push(...listFromSections(mdPath))
        break
      }
    }
  }

  return results
}

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
        const globalDir = resolveGlobalDir(agent)
        const items = listInstalledForAgent(agent, globalDir, null, 'global')
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
                { agent, scope: 'global', config: globalDir, count: items.length, items },
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
      const items = listInstalledForAgent(agent, targetDir, configPath)

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
                items: items.map(i => ({
                  path: i.path,
                  ...(i.title ? { title: i.title } : {}),
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
