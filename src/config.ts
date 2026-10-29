export interface AikConfig {
  contentDir: string
  http: boolean
  port: number
  apiKey: string
  watch: boolean
  validate: boolean
  json: boolean
}

export const loadConfig = (args: string[]): AikConfig => {
  const contentDir = process.env.AIK_CONTENT_DIR ?? process.cwd()
  const apiKey = process.env.MCP_API_KEY ?? ''
  const http = args.includes('--http')
  const portIndex = args.indexOf('--port')
  const port =
    portIndex >= 0 && args[portIndex + 1] !== undefined ? Number(args[portIndex + 1]) : 3456
  const watch = !args.includes('--no-watch')
  const validate = args.includes('--validate')
  const json = args.includes('--json')
  return { contentDir, http, port, apiKey, watch, validate, json }
}
