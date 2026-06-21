export interface AikConfig {
  contentDir: string
  http: boolean
  port: number
  watch: boolean
}

export function loadConfig(args: string[]): AikConfig {
  const contentDir = process.env.AIK_CONTENT_DIR ?? process.cwd()
  const http = args.includes('--http')
  const portIndex = args.indexOf('--port')
  const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 3456
  const watch = !args.includes('--no-watch')
  return { contentDir, http, port, watch }
}
