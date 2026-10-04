import { resolve } from 'node:path'
import type { Category } from '../../content-store.js'
import { findAgentConfig } from './detection.js'
import type { EngineContext, EngineItem } from './engine.js'
import { type Agent, getSupportedCategories } from './factory.js'
import type { Scope } from './types.js'

// Result shape shared by the MCP tool handlers (matches CallToolResult).
export interface ToolResult {
  [key: string]: unknown
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export const textResult = (text: string): ToolResult => ({ content: [{ type: 'text', text }] })

export const errorResult = (text: string): ToolResult => ({
  content: [{ type: 'text', text }],
  isError: true,
})

export const jsonResult = (value: unknown): ToolResult => textResult(JSON.stringify(value, null, 2))

export const contextFor = (
  scope: Scope,
  baseDir: string,
  configPath: string | null
): EngineContext => ({ scope, baseDir, configPath })

export const itemFor = (
  category: Category,
  name: string,
  itemPath: string,
  extra: Partial<Pick<EngineItem, 'title' | 'rawContent' | 'sourceDir'>> = {}
): EngineItem => ({ path: itemPath, category, name, title: '', rawContent: '', ...extra })

export const projectBaseDir = (projectDir?: string): string =>
  projectDir ? resolve(projectDir) : process.cwd()

// Resolve the project-level context: the base directory and the config path of
// the detected agent, kept only when it matches the requested agent.
export interface ProjectContext {
  baseDir: string
  configPath: string | null
  // The path reported by detection, surfaced in tool outputs.
  detectedPath: string
  context: EngineContext
}

export const resolveProjectContext = (agent: Agent, projectDir?: string): ProjectContext | null => {
  const baseDir = projectBaseDir(projectDir)
  const existing = findAgentConfig(baseDir)
  if (!existing) return null

  const configPath = existing.agent === agent ? existing.path : null
  return {
    baseDir,
    configPath,
    detectedPath: existing.path,
    context: contextFor('project', baseDir, configPath),
  }
}

// Guard: the requested category must be supported by the agent in this scope.
export const unsupportedCategory = (
  agent: Agent,
  scope: Scope,
  category: Category
): ToolResult | null =>
  getSupportedCategories(agent, scope).includes(category)
    ? null
    : errorResult(
        `Category "${category}" is not supported for ${scope} scope with agent "${agent}"`
      )

// Guard: only copilot lacks a global layout.
export const globalUnsupported = (agent: Agent, scope: Scope): ToolResult | null =>
  scope === 'global' && agent === 'copilot'
    ? errorResult('Global scope is not supported for copilot')
    : null
