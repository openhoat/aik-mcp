import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { parseFrontmatter } from '../frontmatter.js'
import { logger } from '../logger.js'
import { installClaudeCode, installCline, installOpenCode } from './install.js'
import type { Agent, OpenCodeConfig, ToolRegistrar } from './shared.js'
import { detectAgent, findExistingConfig } from './shared.js'
import { uninstallClaudeCode, uninstallCline, uninstallOpenCode } from './uninstall.js'

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

function getInstalledVersionOpenCode(targetDir: string, itemPath: string): string | null {
  const fullPath = resolve(targetDir, '.opencode', `${itemPath}.md`)
  if (!existsSync(fullPath)) return null
  try {
    const raw = readFileSync(fullPath, 'utf-8')
    return parseFrontmatter(raw).frontmatter.version || null
  } catch {
    return null
  }
}

function getInstalledVersionClaudeCode(configPath: string, itemPath: string): string | null {
  try {
    const content = readFileSync(configPath, 'utf-8')
    const sourceTag = `<source>${itemPath}</source>`
    const idx = content.indexOf(sourceTag)
    if (idx === -1) return null

    const before = content.slice(0, idx)
    const sectionStart = before.lastIndexOf('\n## ')
    if (sectionStart === -1) return null

    const sectionEnd = content.indexOf('\n## ', idx + sourceTag.length)
    const section =
      sectionEnd === -1 ? content.slice(sectionStart) : content.slice(sectionStart, sectionEnd)
    return parseFrontmatter(section).frontmatter.version || null
  } catch {
    return null
  }
}

function getInstalledVersionCline(configPath: string, itemPath: string): string | null {
  try {
    const content = readFileSync(configPath, 'utf-8')
    const marker = `<!-- from ${itemPath} -->`
    const idx = content.indexOf(marker)
    if (idx === -1) return null

    const sectionEnd = content.indexOf('\n<!-- from ', idx + marker.length)
    const section = sectionEnd === -1 ? content.slice(idx) : content.slice(idx, sectionEnd)
    return parseFrontmatter(section).frontmatter.version || null
  } catch {
    return null
  }
}

function getInstalledVersion(
  targetDir: string,
  itemPath: string,
  agent: Agent,
  existingPath: string
): string | null {
  switch (agent) {
    case 'opencode':
      return getInstalledVersionOpenCode(targetDir, itemPath)
    case 'claude-code':
      return getInstalledVersionClaudeCode(existingPath, itemPath)
    case 'cline':
      return getInstalledVersionCline(existingPath, itemPath)
  }
}

function listInstalledOpenCode(configPath: string): string[] {
  const config: OpenCodeConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
  const instructions = config.instructions ?? []
  const results: string[] = []

  for (const entry of instructions) {
    if (!entry.startsWith('.opencode/')) continue
    const noPrefix = entry.slice('.opencode/'.length)
    const noExt = noPrefix.endsWith('.md') ? noPrefix.slice(0, -3) : noPrefix
    results.push(noExt)
  }

  return results
}

function listInstalledClaudeCode(configPath: string): string[] {
  const content = readFileSync(configPath, 'utf-8')
  const results: string[] = []
  const sectionRegex = /^## (.+)$\n(?:.|\n)*?^<source>([\w-]+\/[\w./-]+)<\/source>/gm

  for (const match of content.matchAll(sectionRegex)) {
    results.push(match[2])
  }

  return results
}

function listInstalledCline(configPath: string): string[] {
  const content = readFileSync(configPath, 'utf-8')
  const results: string[] = []
  const markerRegex = /<!-- from ([\w-]+\/[\w./-]+) -->/g

  for (const match of content.matchAll(markerRegex)) {
    results.push(match[1])
  }

  return results
}

interface UpdateInfo {
  path: string
  installedVersion: string | null
  storeVersion: string
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

      let installedPaths: string[]

      switch (agent) {
        case 'opencode':
          installedPaths = listInstalledOpenCode(existing.path)
          break
        case 'claude-code':
          installedPaths = listInstalledClaudeCode(existing.path)
          break
        case 'cline':
          installedPaths = listInstalledCline(existing.path)
          break
      }

      const updates: UpdateInfo[] = []

      for (const itemPath of installedPaths) {
        const storeItem = store.getByPath(itemPath)
        if (!storeItem?.version) continue

        const installedVersion = getInstalledVersion(targetDir, itemPath, agent, existing.path)

        if (!installedVersion || isNewer(storeItem.version, installedVersion)) {
          updates.push({
            path: itemPath,
            installedVersion,
            storeVersion: storeItem.version,
          })
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

      const installedVersion = getInstalledVersion(targetDir, path, agent, existing.path)

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
      let uninstalled = false

      switch (agent) {
        case 'opencode': {
          uninstalled = uninstallOpenCode(existing.path, targetDir, path)
          const configPath = existing.agent === 'opencode' ? existing.path : null
          installOpenCode(configPath, targetDir, storeItem.category, storeItem.name, rawContent)
          break
        }
        case 'claude-code': {
          uninstalled = uninstallClaudeCode(existing.path, path)
          const configPath = existing.agent === 'claude-code' ? existing.path : null
          installClaudeCode(configPath, targetDir, storeItem.path, storeItem.title, rawContent)
          break
        }
        case 'cline': {
          uninstalled = uninstallCline(existing.path, path)
          const configPath = existing.agent === 'cline' ? existing.path : null
          installCline(configPath, targetDir, storeItem.path, rawContent)
          break
        }
      }

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
