import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import type { Agent, OpenCodeConfig, ToolRegistrar } from './shared.js'
import { detectAgent, findExistingConfig } from './shared.js'

interface InstalledItem {
  path: string
  title: string | null
}

export function listInstalledOpenCode(configPath: string, _targetDir: string): InstalledItem[] {
  const config: OpenCodeConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
  const instructions = config.instructions ?? []
  const results: InstalledItem[] = []

  for (const entry of instructions) {
    if (!entry.startsWith('.opencode/')) continue
    const noPrefix = entry.slice('.opencode/'.length)
    const noExt = noPrefix.endsWith('.md') ? noPrefix.slice(0, -3) : noPrefix
    results.push({ path: noExt, title: null })
  }

  return results
}

export function listInstalledClaudeCode(configPath: string): InstalledItem[] {
  const content = readFileSync(configPath, 'utf-8')
  const results: InstalledItem[] = []
  const sectionRegex = /^## (.+)$\n(?:.|\n)*?^<source>([\w-]+\/[\w./-]+)<\/source>/gm

  for (const match of content.matchAll(sectionRegex)) {
    results.push({ path: match[2], title: match[1].trim() })
  }

  return results
}

export function listInstalledCline(configPath: string): InstalledItem[] {
  const content = readFileSync(configPath, 'utf-8')
  const results: InstalledItem[] = []
  const markerRegex = /<!-- from ([\w-]+\/[\w./-]+) -->/g

  for (const match of content.matchAll(markerRegex)) {
    results.push({ path: match[1], title: null })
  }

  return results
}

export function registerListInstalledTool(server: McpServer, _store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'list_installed',
    'List all aik-installed content items in the current project config. Supports opencode, Claude Code, and Cline.',
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
        .describe('Target AI agent. Auto-detected from existing config files if not specified.'),
    },
    async ({ projectDir, agent: preferredAgent }: { projectDir?: string; agent?: Agent }) => {
      logger.trace({ projectDir, agent: preferredAgent }, 'list_installed called')

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const agent = detectAgent(targetDir, preferredAgent)
      const existing = findExistingConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      let items: InstalledItem[]

      switch (agent) {
        case 'opencode':
          items = listInstalledOpenCode(existing.path, targetDir)
          break
        case 'claude-code':
          items = listInstalledClaudeCode(existing.path)
          break
        case 'cline':
          items = listInstalledCline(existing.path)
          break
      }

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
