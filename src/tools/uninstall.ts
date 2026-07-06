import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Category, ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { getInstallSpec } from './agents/factory.js'
import type { Agent, OpenCodeConfig } from './shared.js'
import { findExistingConfig } from './shared.js'

export const removeSections = (
  content: string,
  isTarget: (text: string) => boolean
): { result: string; count: number } => {
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

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

const removeFromOpencodeInstructions = (configPath: string, entry: string): boolean => {
  const config: OpenCodeConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
  const instructions = (config.instructions ?? []).filter(e => e !== entry)

  if (instructions.length === (config.instructions ?? []).length) return false

  config.instructions = instructions
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
  return true
}

export const uninstallContent = (
  agent: Agent,
  category: Category,
  name: string,
  itemPath: string,
  projectDir: string,
  configPath: string | null
): boolean => {
  const spec = getInstallSpec(agent, category)
  const targetFile = spec.contentPath(projectDir, category, name)

  switch (spec.format) {
    case 'file': {
      let removed = false

      if (spec.configUpdate === 'opencode-instructions') {
        const opencodeConfig = configPath ?? resolve(projectDir, '.opencode', 'opencode.jsonc')
        const entry = `.opencode/${category}/${name}.md`
        removed = removeFromOpencodeInstructions(opencodeConfig, entry)
      }

      if (existsSync(targetFile)) {
        unlinkSync(targetFile)
        removed = true
      }
      return removed
    }

    case 'directory-skill': {
      const skillDir = resolve(targetFile, '..')
      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true, force: true })
        return true
      }
      return false
    }

    case 'section': {
      const mdPath = configPath ?? targetFile
      if (!existsSync(mdPath)) return false

      const content = readFileSync(mdPath, 'utf-8')
      const sourceTag = `<source>${itemPath}</source>`
      if (!content.includes(sourceTag)) return false

      const { result, count } = removeSections(content, text => text.includes(sourceTag))
      if (count === 0) return false
      writeFileSync(mdPath, result, 'utf-8')
      return true
    }
  }
}

const uninstallAllForAgent = (
  agent: Agent,
  projectDir: string,
  configPath: string | null
): number => {
  const categories: Category[] = ['rules', 'skills', 'workflows', 'agents', 'commands', 'templates']
  let count = 0

  for (const category of categories) {
    const spec = getInstallSpec(agent, category)

    // Handle file format (rules, workflows, templates, agents, commands)
    if (spec.format === 'file') {
      const targetDir = spec.contentPath(projectDir, category, '').replace(/\/[^/]+\.md$/, '')

      if (!isDirectory(targetDir)) continue

      const entries = readdirSync(targetDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const itemPath = `${category}/${entry.name.replace(/\.md$/, '')}`
          const removed = uninstallContent(
            agent,
            category,
            entry.name.replace(/\.md$/, ''),
            itemPath,
            projectDir,
            configPath
          )
          if (removed) count++
        }
      }
    } else if (spec.format === 'directory-skill') {
      // Handle directory-skill format (skills)
      const targetDir = spec.contentPath(projectDir, category, '').replace(/\/SKILL\.md$/, '')
      if (!isDirectory(targetDir)) continue

      const entries = readdirSync(targetDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillFile = resolve(targetDir, entry.name, 'SKILL.md')
          if (existsSync(skillFile)) {
            rmSync(resolve(targetDir, entry.name), { recursive: true, force: true })
            count++
          }
        }
      }
    }
    // Skip section format (no longer used)
  }

  return count
}

export const registerUninstallTool = (server: McpServer, _store: ContentStore): void => {
  server.registerTool(
    'uninstall',
    {
      description:
        'Uninstall a content item from the current project. Removes the file and the config reference. Supports opencode, Claude Code, Cline, and Codex.',
      inputSchema: {
        path: z.string().describe('Path of the content to uninstall (e.g. "rules/typescript")'),
        projectDir: z
          .string()
          .optional()
          .describe(
            'Project directory (defaults to current working directory). Config files are found by walking up.'
          ),
        agent: z
          .enum(['opencode', 'claude-code', 'cline', 'codex', 'copilot'])
          .describe('Target AI agent (opencode, claude-code, cline, codex, or copilot).'),
      },
    },
    async ({ path, projectDir, agent }: { path: string; projectDir?: string; agent: Agent }) => {
      logger.trace({ path, projectDir, agent }, 'uninstall called')

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const existing = findExistingConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      const [rawCategory, ...rest] = path.split('/')
      const name = rest.join('/')
      const configPath = existing.agent === agent ? existing.path : null

      const validCategories: Category[] = [
        'rules',
        'skills',
        'workflows',
        'agents',
        'commands',
        'templates',
      ]
      const category = validCategories.find(c => c === rawCategory)
      if (!category) {
        return {
          content: [{ type: 'text', text: `Invalid category: ${rawCategory}` }],
          isError: true,
        }
      }

      const removed = uninstallContent(agent, category, name, path, targetDir, configPath)

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

  server.registerTool(
    'uninstall_all',
    {
      description:
        'Uninstall ALL aik-installed content items from the current project. Removes all aik-managed files and config references.',
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
      },
    },
    async ({ projectDir, agent }: { projectDir?: string; agent: Agent }) => {
      logger.trace({ projectDir, agent }, 'uninstall_all called')

      const targetDir = projectDir ? resolve(projectDir) : process.cwd()
      const existing = findExistingConfig(targetDir)

      if (!existing) {
        return {
          content: [{ type: 'text', text: 'No config file found for the detected agent' }],
          isError: true,
        }
      }

      const configPath = existing.agent === agent ? existing.path : null
      const removed = uninstallAllForAgent(agent, targetDir, configPath)

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
