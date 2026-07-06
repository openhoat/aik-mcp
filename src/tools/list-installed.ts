import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Category, ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { getInstallSpec } from './agents/factory.js'
import type { Agent } from './shared.js'
import { findExistingConfig } from './shared.js'

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
  projectDir: string,
  configPath: string | null
): InstalledItem[] => {
  const categories: Category[] = ['rules', 'skills', 'workflows', 'agents', 'commands', 'templates']
  const results: InstalledItem[] = []

  for (const category of categories) {
    const spec = getInstallSpec(agent, category)

    switch (spec.format) {
      case 'file': {
        const baseDir = dirname(spec.contentPath(projectDir, category, 'placeholder'))
        results.push(...listFromFileDir(baseDir, category))
        break
      }
      case 'directory-skill': {
        const skillFile = spec.contentPath(projectDir, category, 'placeholder')
        const baseDir = dirname(dirname(skillFile))
        results.push(...listFromSkillDir(baseDir, category))
        break
      }
      case 'section': {
        const mdPath = configPath ?? spec.contentPath(projectDir, category, 'placeholder')
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
        'List all aik-installed content items in the current project config. Supports opencode, Claude Code, and Cline.',
      inputSchema: {
        projectDir: z
          .string()
          .optional()
          .describe(
            'Project directory (defaults to current working directory). Config files are found by walking up.'
          ),
        agent: z
          .enum(['opencode', 'claude-code', 'cline'])
          .describe('Target AI agent (opencode, claude-code, or cline).'),
      },
    },
    async ({ projectDir, agent }: { projectDir?: string; agent: Agent }) => {
      logger.trace({ projectDir, agent }, 'list_installed called')

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
