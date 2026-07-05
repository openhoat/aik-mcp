import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Category, ContentStore } from '../content-store.js'
import { parseFrontmatter, serializeFrontmatter } from '../frontmatter.js'
import { logger } from '../logger.js'
import { getInstallSpec } from './agent-specs.js'
import type { Agent, OpenCodeConfig, ToolRegistrar } from './shared.js'
import { detectAgent, findExistingConfig } from './shared.js'
import { uninstallContent } from './uninstall.js'

export function openCodeConfigPath(targetDir: string, existingPath: string | null): string {
  if (existingPath) return existingPath
  return resolve(targetDir, '.opencode', 'opencode.jsonc')
}

function buildSkillContent(rawContent: string, name: string): string {
  const { frontmatter, body } = parseFrontmatter(rawContent)
  const skillFrontmatter = {
    name,
    description: frontmatter.description || frontmatter.title,
  }
  const fm = serializeFrontmatter(skillFrontmatter as never)
  return `---\n${fm}\n---\n\n${body}`
}

function updateOpencodeInstructions(configPath: string, instructionsEntry: string): boolean {
  let config: OpenCodeConfig
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, 'utf-8'))
  } else {
    config = {}
  }

  const instructions = config.instructions ?? []
  if (instructions.includes(instructionsEntry)) return false

  instructions.push(instructionsEntry)
  config.instructions = instructions
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
  return true
}

export function installContent(
  agent: Agent,
  category: Category,
  name: string,
  itemPath: string,
  title: string,
  rawContent: string,
  projectDir: string,
  configPath: string | null
): { path: string; alreadyInstalled: boolean } {
  const spec = getInstallSpec(agent, category)
  const targetFile = spec.contentPath(projectDir, category, name)

  switch (spec.format) {
    case 'file': {
      mkdirSync(dirname(targetFile), { recursive: true })
      writeFileSync(targetFile, rawContent, 'utf-8')

      if (spec.configUpdate === 'opencode-instructions') {
        const opencodeConfig = openCodeConfigPath(projectDir, configPath)
        const entry = `.opencode/${category}/${name}.md`
        const wasAdded = updateOpencodeInstructions(opencodeConfig, entry)
        return { path: opencodeConfig, alreadyInstalled: !wasAdded }
      }
      return { path: targetFile, alreadyInstalled: false }
    }

    case 'directory-skill': {
      const skillContent = buildSkillContent(rawContent, name)
      mkdirSync(dirname(targetFile), { recursive: true })
      if (existsSync(targetFile)) {
        return { path: targetFile, alreadyInstalled: true }
      }
      writeFileSync(targetFile, skillContent, 'utf-8')
      return { path: targetFile, alreadyInstalled: false }
    }

    case 'section': {
      const mdPath = configPath ?? targetFile
      const sourceTag = `<source>${itemPath}</source>`
      const section = `\n## ${title}\n\n${sourceTag}\n\n${rawContent.trimEnd()}\n`

      if (existsSync(mdPath)) {
        const existing = readFileSync(mdPath, 'utf-8')
        if (existing.includes(sourceTag)) {
          return { path: mdPath, alreadyInstalled: true }
        }
      }

      appendFileSync(mdPath, section, 'utf-8')
      return { path: mdPath, alreadyInstalled: false }
    }
  }
}

export function registerReinstallTool(server: McpServer, store: ContentStore): void {
  ;(server.tool as unknown as ToolRegistrar)(
    'reinstall',
    'Reinstall a previously installed content item. Uninstalls the old entry and installs the latest version from the knowledge base. Supports opencode, Claude Code, and Cline.',
    {
      path: z.string().describe('Path of the content to reinstall (e.g. "rules/typescript")'),
      projectDir: z
        .string()
        .default(process.cwd())
        .describe(
          'Project directory (defaults to current working directory). Config files are found by walking up.'
        ),
      agent: z
        .enum(['opencode', 'claude-code', 'cline'])
        .optional()
        .describe(
          'Target AI. Auto-detected from existing config files if not specified (opencode, claude-code, cline).'
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
      logger.trace({ path, projectDir, agent: preferredAgent }, 'reinstall called')

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
      const result = installContent(
        agent,
        item.category,
        item.name,
        item.path,
        item.title,
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
    'install',
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
      logger.trace({ path, projectDir, agent: preferredAgent }, 'install called')
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
      const configPath = existing?.agent === agent ? existing.path : null

      const rawContent = readFileSync(item.fullPath, 'utf-8')
      const result = installContent(
        agent,
        item.category,
        item.name,
        item.path,
        item.title,
        rawContent,
        targetDir,
        configPath
      )

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
