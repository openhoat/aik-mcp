import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Resolve the opencode config file to update for the global scope.
// Prefers an existing opencode.json, then opencode.jsonc, defaulting to opencode.json.
export const globalOpencodeConfigPath = (globalDir: string): string => {
  const json = join(globalDir, 'opencode.json')
  const jsonc = join(globalDir, 'opencode.jsonc')
  if (existsSync(json)) return json
  if (existsSync(jsonc)) return jsonc
  return json
}

// Render an absolute path under the home directory with a leading "~".
export const toHomePath = (absolutePath: string): string => {
  const home = homedir()
  if (home && absolutePath.startsWith(home)) return `~${absolutePath.slice(home.length)}`
  return absolutePath
}

// The value written to the opencode "instructions" array for an installed item.
export const opencodeInstructionsEntry = (
  scope: 'project' | 'global',
  targetFile: string,
  category: string,
  name: string
): string => (scope === 'global' ? toHomePath(targetFile) : `.opencode/${category}/${name}.md`)
