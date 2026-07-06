export interface AikConfig {
  contentDir: string
  http: boolean
  port: number
  watch: boolean
  validate: boolean
  json: boolean
}

export const loadConfig = (args: string[]): AikConfig => {
  const contentDir = process.env.AIK_CONTENT_DIR ?? process.cwd()
  const http = args.includes('--http')
  const portIndex = args.indexOf('--port')
  const port =
    portIndex >= 0 && args[portIndex + 1] !== undefined ? Number(args[portIndex + 1]) : 3456
  const watch = !args.includes('--no-watch')
  const validate = args.includes('--validate')
  const json = args.includes('--json')
  return { contentDir, http, port, watch, validate, json }
}
