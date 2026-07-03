import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import type { Agent, OpenCodeConfig, ToolRegistrar } from './shared.js'
import { detectAgent, findExistingConfig } from './shared.js'

export function uninstallOpenCode(
  configPath: string,
  targetDir: string,
  itemPath: string
): boolean {
  const instructionsEntry = `.opencode/${itemPath}.md`
  const fullPath = resolve(targetDir, instructionsEntry)

  const config: OpenCodeConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
  const instructions = (config.instructions ?? []).filter(e => e !== instructionsEntry)

  if (instructions.length === (config.instructions ?? []).length) return false

  config.instructions = instructions
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')

  if (existsSync(fullPath)) unlinkSync(fullPath)
  return true
}

export function uninstallAllOpenCode(configPath: string, targetDir: string): number {
  const config: OpenCodeConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
  const instructions = config.instructions ?? []

  const aikEntries = instructions.filter(e => e.startsWith('.opencode/'))
  if (aikEntries.length === 0) return 0

  for (const entry of aikEntries) {
    const fullPath = resolve(targetDir, entry)
    if (existsSync(fullPath)) unlinkSync(fullPath)
  }

  config.instructions = instructions.filter(e => !e.startsWith('.opencode/'))
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
  return aikEntries.length
}

export function removeSections(
  content: string,
  isTarget: (text: string) => boolean
): { result: string; count: number } {
  const lines = content.split('\n')
  const kept: string[] = []
  let count = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ') && isTarget(lines.slice(i).join('\n'))) {
      count++
      i++
      while (i < lines.length && !lines[i].startsWith('## ')) {
        i++
      }
      continue
    }

    if (/^<!-- from /.test(line) && isTarget(line)) {
      count++
      i++
      while (i < lines.length && !lines[i].startsWith('## ') && !/^<!-- from /.test(lines[i])) {
        i++
      }
      continue
    }

    kept.push(line)
    i++
  }

  return { result: kept.join('\n'), count }
}

export function uninstallClaudeCode(configPath: string, itemPath: string): boolean {
  const content = readFileSync(configPath, 'utf-8')
  const sourceTag = `<source>${itemPath}</source>`
  if (!content.includes(sourceTag)) return false

  const { result, count } = removeSections(content, text => text.includes(sourceTag))
  if (count === 0) return false
  writeFileSync(configPath, result, 'utf-8')
  return true
}

export function uninstallAllClaudeCode(configPath: string): number {
  const content = readFileSync(configPath, 'utf-8')
  if (!/<source>[\w-]+\/[\w./-]+<\/source>/.test(content)) return 0

  const { result, count } = removeSections(content, text =>
    /<source>[\w-]+\/[\w./-]+<\/source>/.test(text)
  )
  if (count === 0) return 0
  writeFileSync(configPath, result, 'utf-8')
  return count
}

export function uninstallCline(configPath: string, itemPath: string): boolean {
  const content = readFileSync(configPath, 'utf-8')
  const marker = `<!-- from ${itemPath} -->`
  if (!content.includes(marker)) return false

  const { result, count } = removeSections(content, text => text.includes(marker))
  if (count === 0) return false
  writeFileSync(configPath, result, 'utf-8')
  return true
}

export function uninstallAllCline(configPath: string): number {
  const content = readFileSync(configPath, 'utf-8')
  if (!/<!-- from [\w-]+\/[\w./-]+ -->/.test(content)) return 0

  const { result, count } = removeSections(content, text =>
    /<!-- from [\w-]+\/[\w./-]+ -->/.test(text)
  )
  if (count === 0) return 0
  writeFileSync(configPath, result, 'utf-8')
  return count
}

export function registerUninstallTool(server: McpServer, _store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'uninstall',
    'Uninstall a previously installed content item from the current project. Removes the file and the config reference. Supports opencode, Claude Code, and Cline.',
    {
      path: z.string().describe('Path of the content to uninstall (e.g. "rules/typescript")'),
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
    async ({
      path,
      projectDir,
      agent: preferredAgent,
    }: {
      path: string
      projectDir?: string
      agent?: Agent
    }) => {
      logger.trace({ path, projectDir, agent: preferredAgent }, 'uninstall called')

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const agent = detectAgent(targetDir, preferredAgent)
      const existing = findExistingConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      let removed = false

      switch (agent) {
        case 'opencode': {
          removed = uninstallOpenCode(existing.path, targetDir, path)
          break
        }
        case 'claude-code': {
          removed = uninstallClaudeCode(existing.path, path)
          break
        }
        case 'cline': {
          removed = uninstallCline(existing.path, path)
          break
        }
      }

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

  ;(server.tool as unknown as ToolRegistrar)(
    'uninstall_all',
    'Uninstall ALL aik-installed content items from the current project. Removes all aik-managed files and config references.',
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
      logger.trace({ projectDir, agent: preferredAgent }, 'uninstall_all called')

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const agent = detectAgent(targetDir, preferredAgent)
      const existing = findExistingConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      let removed = 0

      switch (agent) {
        case 'opencode': {
          removed = uninstallAllOpenCode(existing.path, targetDir)
          break
        }
        case 'claude-code': {
          removed = uninstallAllClaudeCode(existing.path)
          break
        }
        case 'cline': {
          removed = uninstallAllCline(existing.path)
          break
        }
      }

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
