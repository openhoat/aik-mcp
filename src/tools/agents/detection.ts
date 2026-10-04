import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { getAgentConfig, getAllAgents } from './factory.js'
import type { Agent, DetectionPattern } from './types.js'

export interface AgentDetection {
  agent: Agent
  path: string
}

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

const matches = (dir: string, pattern: DetectionPattern): boolean => {
  const candidate = resolve(dir, pattern.path)
  return pattern.kind === 'directory' ? isDirectory(candidate) : existsSync(candidate)
}

// Agents are probed in priority order. The list is derived from the registry,
// never hard-coded, so adding an agent does not require editing this module.
const detectionOrder = (): Agent[] =>
  getAllAgents()
    .slice()
    .sort(
      (a, b) =>
        getAgentConfig(a).agent.detectionPriority - getAgentConfig(b).agent.detectionPriority
    )

export const findAgentConfig = (dir: string): AgentDetection | null => {
  let current = resolve(dir)

  for (let i = 0; i < 10; i++) {
    for (const agent of detectionOrder()) {
      for (const pattern of getAgentConfig(agent).agent.detectionPatterns) {
        if (matches(current, pattern)) {
          return { agent, path: resolve(current, pattern.report ?? pattern.path) }
        }
      }
    }

    // Move up the directory tree
    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }

  return null
}

export const detectAgent = (dir: string, preferred?: Agent): Agent => {
  if (preferred && getAllAgents().includes(preferred)) return preferred

  const detected = findAgentConfig(dir)
  return detected?.agent ?? 'opencode'
}
