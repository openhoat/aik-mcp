import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Marker files used to detect the technology stacks of a project.
 * A stack is detected when at least one of its markers exists at the project root.
 */
export const STACK_MARKERS: Record<string, string[]> = {
  python: ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'],
  angular: ['angular.json'],
  nodejs: ['package.json'],
  rust: ['Cargo.toml'],
  go: ['go.mod'],
  java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
  php: ['composer.json'],
  ruby: ['Gemfile'],
}

/**
 * Detect the technology stacks of a project from marker files.
 * Returns an empty array when nothing is recognized (unknown project).
 */
export const detectStacks = (projectDir: string): string[] => {
  const stacks: string[] = []
  for (const [stack, markers] of Object.entries(STACK_MARKERS)) {
    if (markers.some(marker => existsSync(resolve(projectDir, marker)))) {
      stacks.push(stack)
    }
  }
  return stacks
}

interface McpConfigSource {
  file: string
  keys: string[]
}

const MCP_CONFIG_SOURCES: McpConfigSource[] = [
  { file: '.mcp.json', keys: ['mcpServers'] },
  { file: '.vscode/mcp.json', keys: ['servers'] },
  { file: '.cursor/mcp.json', keys: ['mcpServers'] },
  { file: '.opencode/opencode.jsonc', keys: ['mcp'] },
  { file: '.opencode/opencode.json', keys: ['mcp'] },
  { file: 'opencode.jsonc', keys: ['mcp'] },
  { file: 'opencode.json', keys: ['mcp'] },
]

const stripJsonComments = (raw: string): string =>
  raw.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const parseJsonc = (raw: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    try {
      return JSON.parse(stripJsonComments(raw)) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

const addSectionServers = (
  parsed: Record<string, unknown>,
  keys: string[],
  servers: Set<string>
): boolean => {
  let found = false
  for (const key of keys) {
    const section = parsed[key]
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      found = true
      for (const name of Object.keys(section as Record<string, unknown>)) {
        servers.add(name)
      }
    }
  }
  return found
}

/**
 * Detect the MCP server names declared in the project configuration.
 * Returns `null` when no MCP configuration file could be found (unknown),
 * as opposed to an empty array which means "configured, but no server".
 */
export const detectMcpServers = (projectDir: string): string[] | null => {
  const servers = new Set<string>()
  let foundConfig = false

  for (const source of MCP_CONFIG_SOURCES) {
    const fullPath = resolve(projectDir, source.file)
    if (!existsSync(fullPath)) continue

    const parsed = parseJsonc(readFileSync(fullPath, 'utf-8'))
    if (!parsed) continue

    if (addSectionServers(parsed, source.keys, servers)) foundConfig = true
  }

  return foundConfig ? [...servers] : null
}

const normalizeServerName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/^mcp[-_]/, '')
    .replace(/[-_]/g, '')

export interface GatingMetadata {
  appliesTo: string[]
  requires: string[]
}

export interface GateResult {
  blocked: boolean
  errors: string[]
  warnings: string[]
  projectStacks: string[]
  mcpServers: string[] | null
}

/**
 * Evaluate whether a content item may be installed in a project.
 *
 * Gating is evidence-based to avoid false positives:
 * - `applies-to` blocks only when the project stacks were detected and none match.
 * - `requires` blocks only when the MCP configuration was found and none matches.
 * When the information is missing, a warning is emitted instead of a block.
 */
const evaluateStacks = (
  appliesTo: string[],
  projectStacks: string[]
): { errors: string[]; warnings: string[] } => {
  const errors: string[] = []
  const warnings: string[] = []
  if (appliesTo.length === 0) return { errors, warnings }

  if (projectStacks.length === 0) {
    warnings.push(
      `Could not detect the project stack; this content applies to: ${appliesTo.join(', ')}.`
    )
  } else if (!appliesTo.some(stack => projectStacks.includes(stack))) {
    errors.push(
      `This content applies to [${appliesTo.join(', ')}] but the project stack is [${projectStacks.join(', ')}].`
    )
  }
  return { errors, warnings }
}

const evaluateRequires = (
  requires: string[],
  mcpServers: string[] | null
): { errors: string[]; warnings: string[] } => {
  const errors: string[] = []
  const warnings: string[] = []
  if (requires.length === 0) return { errors, warnings }

  if (mcpServers === null) {
    warnings.push(
      `Could not verify the required MCP server(s): ${requires.join(', ')} (no MCP configuration found).`
    )
    return { errors, warnings }
  }

  const missing = requires.filter(
    req => !mcpServers.some(server => normalizeServerName(server) === normalizeServerName(req))
  )
  if (missing.length > 0) {
    errors.push(
      `Missing required MCP server(s): ${missing.join(', ')} (configured: ${mcpServers.length > 0 ? mcpServers.join(', ') : 'none'}).`
    )
  }
  return { errors, warnings }
}

export const evaluateGate = (
  metadata: GatingMetadata,
  projectDir: string,
  options: { force?: boolean } = {}
): GateResult => {
  const projectStacks = detectStacks(projectDir)
  const mcpServers = detectMcpServers(projectDir)

  const stacks = evaluateStacks(metadata.appliesTo ?? [], projectStacks)
  const requires = evaluateRequires(metadata.requires ?? [], mcpServers)
  const errors = [...stacks.errors, ...requires.errors]
  const warnings = [...stacks.warnings, ...requires.warnings]

  const blocked = errors.length > 0 && !options.force
  return { blocked, errors, warnings, projectStacks, mcpServers }
}
