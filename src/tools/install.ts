import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Category, ContentStore } from '../content-store.js'
import { parseFrontmatter, serializeFrontmatterRaw } from '../frontmatter.js'
import { logger } from '../logger.js'
import { getInstallSpecForScope } from './agents/factory.js'
import type { Agent, OpenCodeConfig, Scope } from './shared.js'
import { findExistingConfig, resolveGlobalDir } from './shared.js'
import { uninstallContent } from './uninstall.js'

export const openCodeConfigPath = (targetDir: string, existingPath: string | null): string => {
  if (existingPath) return existingPath
  return resolve(targetDir, '.opencode', 'opencode.jsonc')
}

const ENTRY_FILE = 'README.md'

const buildSkillContent = (rawContent: string, name: string): string => {
  const { raw, body } = parseFrontmatter(rawContent)
  const skillFrontmatter = { ...raw }
  if (!skillFrontmatter.name) skillFrontmatter.name = name
  const fm = serializeFrontmatterRaw(skillFrontmatter)
  return `---\n${fm}\n---\n\n${body}`
}

const copyBundleAssets = (sourceDir: string, targetDir: string): void => {
  const entries = readdirSync(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === ENTRY_FILE) continue
    const src = join(sourceDir, entry.name)
    const dest = join(targetDir, entry.name)
    cpSync(src, dest, { recursive: true })
  }
}

const updateOpencodeInstructions = (configPath: string, instructionsEntry: string): boolean => {
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
  const spec = getInstallSpecForScope(agent, category, scope)
  const targetFile = spec.contentPath(targetDir, category, name)

  switch (spec.format) {
    case 'file': {
      mkdirSync(dirname(targetFile), { recursive: true })
      writeFileSync(targetFile, rawContent, 'utf-8')

      if (scope === 'project' && spec.configUpdate === 'opencode-instructions') {
        const opencodeConfig = openCodeConfigPath(targetDir, configPath)
        const entry = `.opencode/${category}/${name}.md`
        const wasAdded = updateOpencodeInstructions(opencodeConfig, entry)
        return { path: opencodeConfig, alreadyInstalled: !wasAdded }
      }
      return { path: targetFile, alreadyInstalled: false }
    }

    case 'directory-skill': {
      const skillDir = dirname(targetFile)
      if (existsSync(targetFile)) {
        return { path: targetFile, alreadyInstalled: true }
      }
      mkdirSync(skillDir, { recursive: true })
      if (sourceDir && existsSync(sourceDir)) {
        copyBundleAssets(sourceDir, skillDir)
      }
      const skillContent = buildSkillContent(rawContent, name)
      writeFileSync(targetFile, skillContent, 'utf-8')
      return { path: targetFile, alreadyInstalled: false }
    }

    case 'section': {
      const mdPath = configPath ?? targetFile
      const sourceTag = `<source>${itemPath}</source>`

      const { body } = parseFrontmatter(rawContent)
      const section = `\n## ${title}\n\n${sourceTag}\n\n${body.trimEnd()}\n`

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
        const globalDir = resolveGlobalDir(agent)
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
        const result = installContent(
          agent,
          item.category,
          item.name,
          item.path,
          item.title,
          rawContent,
          globalDir,
          null,
          'global',
          dirname(item.fullPath)
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
        configPath,
        'project',
        dirname(item.fullPath)
      )

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { reinstalled: path, agent, hadPreviousInstall: uninstalled, config: result.path },
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

      if (effectiveScope === 'global') {
        if (agent === 'copilot') {
          return {
            content: [{ type: 'text', text: 'Global scope is not supported for copilot' }],
            isError: true,
          }
        }
        const globalDir = resolveGlobalDir(agent)
        const result = installContent(
          agent,
          item.category,
          item.name,
          item.path,
          item.title,
          rawContent,
          globalDir,
          null,
          'global',
          dirname(item.fullPath)
        )
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
      const existing = findExistingConfig(targetDir)
      const configPath = existing && existing.agent === agent ? existing.path : null

      const result = installContent(
        agent,
        item.category,
        item.name,
        item.path,
        item.title,
        rawContent,
        targetDir,
        configPath,
        'project',
        dirname(item.fullPath)
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
              { installed: path, agent, file: item.fullPath, config: result.path },
              null,
              2
            ),
          },
        ],
      }
    }
  )
}
