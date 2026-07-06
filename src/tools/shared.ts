import { detectAgent as detectAgentImpl, findAgentConfig } from './agents/detection.js'
import { getAllAgents } from './agents/factory.js'
import type { Agent as AgentType } from './agents/types.js'

export type Agent = AgentType

export const AGENTS = getAllAgents()

export interface OpenCodeConfig {
  instructions?: string[]
  [key: string]: unknown
}

export const findExistingConfig = (dir: string): { path: string; agent: Agent } | null => {
  return findAgentConfig(dir)
}

export const detectAgent = (dir: string, preferred?: Agent): Agent => {
  return detectAgentImpl(dir, preferred)
}
