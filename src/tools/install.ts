import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import type { Agent, OpenCodeConfig, ToolRegistrar } from './shared.js'
import { detectAgent, findExistingConfig } from './shared.js'
import { uninstallClaudeCode, uninstallCline, uninstallOpenCode } from './uninstall.js'

function openCodeConfigPath(targetDir: string, existingPath: string | null): string {
  if (existingPath) return existingPath
  return resolve(targetDir, '.opencode', 'opencode.jsonc')
}

function installOpenCode(
  configPath: string | null,
  targetDir: string,
  category: string,
  name: string,
  rawContent: string
): { path: string; alreadyInstalled: boolean } {
  const openCodeDir = resolve(targetDir, '.opencode', category)
  const targetFile = resolve(openCodeDir, `${name}.md`)
  const instructionsEntry = `.opencode/${category}/${name}.md`

  mkdirSync(openCodeDir, { recursive: true })
  writeFileSync(targetFile, rawContent, 'utf-8')

  const outputPath = openCodeConfigPath(targetDir, configPath)

  let config: OpenCodeConfig
  if (configPath) {
    config = JSON.parse(readFileSync(configPath, 'utf-8'))
  } else {
    config = {}
  }

  const instructions = config.instructions ?? []

  if (instructions.includes(instructionsEntry)) {
    return { path: outputPath, alreadyInstalled: true }
  }

  instructions.push(instructionsEntry)
  config.instructions = instructions
  mkdirSync(resolve(outputPath, '..'), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
  return { path: outputPath, alreadyInstalled: false }
}

function installClaudeCode(
  configPath: string | null,
  targetDir: string,
  itemPath: string,
  title: string,
  rawContent: string
): { path: string; alreadyInstalled: boolean } {
  const mdPath = configPath ?? resolve(targetDir, 'CLAUDE.md')
  const sectionId = `aik:${itemPath}`

  const section = `\n## ${title}\n\n<source>${itemPath}</source>\n\n${rawContent.trimEnd()}\n`

  if (existsSync(mdPath)) {
    const existing = readFileSync(mdPath, 'utf-8')
    if (existing.includes(sectionId)) {
      return { path: mdPath, alreadyInstalled: true }
    }
  }

  appendFileSync(mdPath, section, 'utf-8')
  return { path: mdPath, alreadyInstalled: false }
}

function installCline(
  configPath: string | null,
  targetDir: string,
  itemPath: string,
  rawContent: string
): { path: string; alreadyInstalled: boolean } {
  const rulesPath = configPath ?? resolve(targetDir, '.clinerules')

  const sectionId = `aik:${itemPath}`
  const entry = `\n<!-- from ${itemPath} -->\n${rawContent.trimEnd()}\n`

  if (existsSync(rulesPath)) {
    const existing = readFileSync(rulesPath, 'utf-8')
    if (existing.includes(sectionId)) {
      return { path: rulesPath, alreadyInstalled: true }
    }
  }

  appendFileSync(rulesPath, entry, 'utf-8')
  return { path: rulesPath, alreadyInstalled: false }
}

export function registerReinstallTool(server: McpServer, store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'aik_reinstall',
    'Reinstall a previously installed content item. Uninstalls the old entry and installs the latest version from the knowledge base. Supports opencode, Claude Code, and Cline.',
    {
      path: z.string().describe('Path of the content to reinstall (e.g. "rules/typescript")'),
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
      logger.trace({ path, projectDir, agent: preferredAgent }, 'aik_reinstall called')

      const item = store.getByPath(path)
      if (!item) {
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

      let uninstalled = false

      switch (agent) {
        case 'opencode':
          uninstalled = uninstallOpenCode(existing.path, targetDir, path)
          break
        case 'claude-code':
          uninstalled = uninstallClaudeCode(existing.path, path)
          break
        case 'cline':
          uninstalled = uninstallCline(existing.path, path)
          break
      }

      const rawContent = readFileSync(item.fullPath, 'utf-8')
      let result: { path: string; alreadyInstalled: boolean }

      switch (agent) {
        case 'opencode': {
          const configPath = existing.agent === 'opencode' ? existing.path : null
          result = installOpenCode(configPath, targetDir, item.category, item.name, rawContent)
          break
        }
        case 'claude-code': {
          const configPath = existing.agent === 'claude-code' ? existing.path : null
          result = installClaudeCode(configPath, targetDir, item.path, item.title, rawContent)
          break
        }
        case 'cline': {
          const configPath = existing.agent === 'cline' ? existing.path : null
          result = installCline(configPath, targetDir, item.path, rawContent)
          break
        }
      }

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

export function registerInstallTool(server: McpServer, store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'aik_install',
    'Install a content item (rule, skill, workflow, agent, command, or template) into the current project so it is loaded automatically in future sessions. Supports opencode, Claude Code, and Cline.',
    {
      path: z.string().describe('Path of the content to install (e.g. "rules/typescript")'),
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
      logger.trace({ path, projectDir, agent: preferredAgent }, 'aik_install called')
      const item = store.getByPath(path)
      if (!item) {
        return {
          content: [{ type: 'text', text: `Content not found: ${path}` }],
          isError: true,
        }
      }

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const agent = detectAgent(targetDir, preferredAgent)
      const existing = findExistingConfig(targetDir)

      let result: { path: string; alreadyInstalled: boolean }

      switch (agent) {
        case 'opencode': {
          const configPath = existing?.agent === 'opencode' ? existing.path : null
          const rawContent = readFileSync(item.fullPath, 'utf-8')
          result = installOpenCode(configPath, targetDir, item.category, item.name, rawContent)
          break
        }
        case 'claude-code': {
          const configPath = existing?.agent === 'claude-code' ? existing.path : null
          const rawContent = readFileSync(item.fullPath, 'utf-8')
          result = installClaudeCode(configPath, targetDir, item.path, item.title, rawContent)
          break
        }
        case 'cline': {
          const configPath = existing?.agent === 'cline' ? existing.path : null
          const rawContent = readFileSync(item.fullPath, 'utf-8')
          result = installCline(configPath, targetDir, item.path, rawContent)
          break
        }
      }

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
