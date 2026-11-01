import { type ChildProcess, spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFile, createTempDir } from '../helpers.js'

// End-to-end proof of the remote contract: over HTTP the install family plans,
// it never writes. The child process runs with a working directory of its own,
// so any server-side write would be visible on disk.

const __dirname = dirname(fileURLToPath(import.meta.url))
const distIndex = resolve(__dirname, '../../../build/index.js')

const API_KEY = 'e2e-plan-api-key'

interface JsonRpcBody {
  jsonrpc: '2.0'
  id?: number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResult {
  result?: unknown
  error?: { message: string }
}

const freePort = async (): Promise<number> =>
  new Promise((resolvePort, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        reject(new Error('no port allocated'))
        return
      }
      const { port } = address
      server.close(() => resolvePort(port))
    })
  })

const parseBody = (raw: string, contentType: string | null): JsonRpcResult => {
  if (!contentType?.includes('text/event-stream')) return JSON.parse(raw) as JsonRpcResult
  const data = raw
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => line.slice('data: '.length))
    .at(-1)
  if (!data) throw new Error(`no data frame in SSE response: ${raw.slice(0, 200)}`)
  return JSON.parse(data) as JsonRpcResult
}

const waitForHealth = async (base: string): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) return
    } catch {
      /* not listening yet */
    }
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('server did not become healthy')
}

describe('HTTP transport: plan mode end to end', () => {
  let contentDir: string
  let workDir: string
  let server: ChildProcess
  let base: string
  let sessionId: string | undefined

  const rpc = async (body: JsonRpcBody): Promise<JsonRpcResult> => {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${API_KEY}`,
        ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      },
      body: JSON.stringify(body),
    })
    sessionId = res.headers.get('mcp-session-id') ?? sessionId
    const raw = await res.text()
    return raw ? parseBody(raw, res.headers.get('content-type')) : {}
  }

  beforeAll(async () => {
    contentDir = createTempDir()
    workDir = createTempDir()
    await createFile(
      contentDir,
      'rules/demo-rule',
      '---\ntitle: Demo Rule\ndescription: demo\ntags: [test]\nversion: "1.2.0"\n---\n\n# Demo Rule\n\nBody.\n'
    )
    await createFile(
      contentDir,
      'skills/demo-skill',
      '---\ntitle: Demo Skill\ndescription: demo\ntags: [test]\nversion: "1.0.0"\n---\n\n# Demo Skill\n\nBody.\n'
    )

    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, [distIndex, '--http', '--port', String(port), '--no-watch'], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AIK_CONTENT_DIR: contentDir,
        MCP_API_KEY: API_KEY,
        LOG_LEVEL: 'silent',
      },
    })
    await waitForHealth(base)

    await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'aik-e2e-http', version: '1.0.0' },
      },
    })
    await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })
  }, 20000)

  afterAll(async () => {
    server?.kill('SIGKILL')
    await new Promise<void>(r => (server ? server.on('exit', () => r()) : r()))
  })

  test('exposes the 10 HTTP tools and drops the server-side lifecycle tools', async () => {
    const { result } = await rpc({ jsonrpc: '2.0', id: 10, method: 'tools/list' })
    const tools = (result as { tools: Array<{ name: string }> }).tools.map(tool => tool.name)

    expect(tools.sort()).toEqual(
      [
        'check_updates',
        'delete',
        'get',
        'get_asset',
        'install',
        'layout',
        'list',
        'search',
        'uninstall',
        'write',
      ].sort()
    )
    for (const dropped of ['reinstall', 'update', 'list_installed', 'uninstall_all']) {
      expect(tools).not.toContain(dropped)
    }
  })

  test('install returns a plan and writes nothing on the server', async () => {
    const { result } = await rpc({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'install',
        arguments: { path: 'rules/demo-rule', agent: 'opencode', scope: 'project' },
      },
    })

    const text = (result as { content: Array<{ text: string }> }).content[0].text
    const plan = JSON.parse(text) as {
      planVersion: number
      actions: Array<{ op: string; path?: string; sha256?: string }>
    }

    expect(plan.planVersion).toBe(1)
    expect(plan.actions).toEqual([
      expect.objectContaining({ op: 'write_file', path: '.opencode/rules/demo-rule.md' }),
      expect.objectContaining({ op: 'config_entry_add', path: '.opencode/rules/demo-rule.md' }),
    ])
    expect(plan.actions[0].sha256).toMatch(/^[0-9a-f]{64}$/)
    // The plan is declarative: the server working directory stays empty.
    expect(readdirSync(workDir)).toEqual([])
  })

  test('a skill plan embeds its bundle and its assets', async () => {
    const { result } = await rpc({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'install',
        arguments: { path: 'skills/demo-skill', agent: 'claude-code', scope: 'global' },
      },
    })

    const plan = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text) as {
      base: { hint: string }
      actions: Record<string, unknown>[]
    }

    expect(plan.base).toEqual({ kind: 'agent-global', hint: '~/.claude' })
    expect(plan.actions[0]).toEqual(
      expect.objectContaining({ op: 'install_skill', dir: 'skills/demo-skill' })
    )
    expect(readdirSync(workDir)).toEqual([])
  })

  test('GET /plan serves the same plan for a shell client', async () => {
    const res = await fetch(`${base}/plan/rules/demo-rule?agent=codex&scope=project`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    const plan = (await res.json()) as { agent: string; actions: Array<{ op: string }> }

    expect(res.status).toBe(200)
    expect(plan.agent).toBe('codex')
    expect(plan.actions[0].op).toBe('section_upsert')
  })

  test('GET /plan requires the bearer token and a known item', async () => {
    const anonymous = await fetch(`${base}/plan/rules/demo-rule`)
    expect(anonymous.status).toBe(401)

    const missing = await fetch(`${base}/plan/rules/nope`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    expect(missing.status).toBe(404)
  })

  test('check_updates answers from the inventory the client sends', async () => {
    const { result } = await rpc({
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: {
        name: 'check_updates',
        arguments: {
          items: [
            { path: 'rules/demo-rule', version: '1.0.0' },
            { path: 'skills/demo-skill', version: '1.0.0' },
          ],
        },
      },
    })

    const report = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text) as {
      updates: Record<string, string>[]
    }

    expect(report.updates).toEqual([
      { path: 'rules/demo-rule', installedVersion: '1.0.0', storeVersion: '1.2.0' },
    ])
  })

  test('layout answers with relative paths, usable from any machine', async () => {
    const { result } = await rpc({
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: { name: 'layout', arguments: {} },
    })

    const text = (result as { content: Array<{ text: string }> }).content[0].text
    expect(text).toContain('"~/.config/opencode"')
    expect(text).not.toContain(workDir)
  })
})
