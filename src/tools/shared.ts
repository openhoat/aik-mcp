import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { z } from 'zod'

export type Agent = 'opencode' | 'claude-code' | 'cline'

export type ToolRegistrar = <T extends Record<string, unknown>>(
  name: string,
  description: string,
  paramsSchema: Record<string, z.ZodTypeAny>,
  cb: (args: T, extra: Record<string, unknown>) => unknown
) => McpServer

export const AGENTS: Agent[] = ['opencode', 'claude-code', 'cline']

export interface OpenCodeConfig {
  instructions?: string[]
  [key: string]: unknown
}

export function findExistingConfig(dir: string): { path: string; agent: Agent } | null {
  let current = resolve(dir)
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(current, '.opencode', 'opencode.jsonc')))
      return { path: resolve(current, '.opencode', 'opencode.jsonc'), agent: 'opencode' }
    if (existsSync(resolve(current, '.opencode', 'opencode.json')))
      return { path: resolve(current, '.opencode', 'opencode.json'), agent: 'opencode' }
    if (existsSync(resolve(current, 'opencode.json')))
      return { path: resolve(current, 'opencode.json'), agent: 'opencode' }
    if (existsSync(resolve(current, 'opencode.jsonc')))
      return { path: resolve(current, 'opencode.jsonc'), agent: 'opencode' }
    if (existsSync(resolve(current, 'CLAUDE.md')))
      return { path: resolve(current, 'CLAUDE.md'), agent: 'claude-code' }
    if (existsSync(resolve(current, '.clinerules')))
      return { path: resolve(current, '.clinerules'), agent: 'cline' }
    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }
  return null
}

export function detectAgent(dir: string, preferred?: Agent): Agent {
  if (preferred && AGENTS.includes(preferred)) return preferred
  const existing = findExistingConfig(dir)
  return existing?.agent ?? 'opencode'
}
