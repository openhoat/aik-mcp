import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Agent } from './types.js'

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export interface AgentDetection {
  agent: Agent
  path: string
  priority: number
}

// Detection patterns for each agent
const DETECTION_PATTERNS: Record<Agent, Array<(dir: string) => AgentDetection | null>> = {
  opencode: [
    dir => {
      const path = resolve(dir, '.opencode', 'opencode.jsonc')
      if (existsSync(path)) return { agent: 'opencode', path, priority: 1 }
      return null
    },
    dir => {
      const path = resolve(dir, '.opencode', 'opencode.json')
      if (existsSync(path)) return { agent: 'opencode', path, priority: 2 }
      return null
    },
    dir => {
      const path = resolve(dir, 'opencode.json')
      if (existsSync(path)) return { agent: 'opencode', path, priority: 3 }
      return null
    },
    dir => {
      const path = resolve(dir, 'opencode.jsonc')
      if (existsSync(path)) return { agent: 'opencode', path, priority: 4 }
      return null
    },
  ],
  'claude-code': [
    dir => {
      const path = resolve(dir, 'CLAUDE.md')
      if (existsSync(path)) return { agent: 'claude-code', path, priority: 5 }
      return null
    },
    dir => {
      const path = resolve(dir, '.claude')
      if (isDirectory(path)) return { agent: 'claude-code', path, priority: 6 }
      return null
    },
  ],
  cline: [
    dir => {
      const path = resolve(dir, '.clinerules')
      if (existsSync(path)) return { agent: 'cline', path, priority: 7 }
      return null
    },
    dir => {
      const path = resolve(dir, '.cline')
      if (isDirectory(path)) return { agent: 'cline', path, priority: 8 }
      return null
    },
  ],
}

export const findAgentConfig = (dir: string): AgentDetection | null => {
  let current = resolve(dir)

  for (let i = 0; i < 10; i++) {
    // Check all agents using their detection patterns
    // Safe: literal array values match the Agent union type
    for (const agent of ['opencode', 'claude-code', 'cline'] as Agent[]) {
      // Safe: DETECTION_PATTERNS keys are Agent type
      for (const pattern of DETECTION_PATTERNS[agent]) {
        const result = pattern(current)
        if (result) return result
      }
    }

    // Move up the directory tree
    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }

  return null
}

const AGENTS: Agent[] = ['opencode', 'claude-code', 'cline']

export const detectAgent = (dir: string, preferred?: Agent): Agent => {
  if (preferred && AGENTS.includes(preferred)) return preferred

  const detected = findAgentConfig(dir)
  return detected?.agent ?? 'opencode'
}
