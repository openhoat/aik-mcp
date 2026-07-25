import { detectAgent as detectAgentImpl, findAgentConfig } from './agents/detection.js'
import { getAllAgents, getGlobalBaseDir, getGlobalSupportedCategories } from './agents/factory.js'
import type { Agent as AgentType, Category, Scope } from './agents/types.js'
import { CATEGORIES } from './agents/types.js'

export type Agent = AgentType
export type { Scope }
export { CATEGORIES }

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

export const resolveGlobalDir = (agent: Agent): string => {
  return getGlobalBaseDir(agent)
}

export const getGlobalCategories = (agent: Agent): Category[] => {
  return getGlobalSupportedCategories(agent)
}
