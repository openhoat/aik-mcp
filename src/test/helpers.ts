import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distIndex = resolve(__dirname, '../../build/index.js')

export const createTempDir = (): string => {
  return mkdtempSync(join(tmpdir(), 'aik-e2e-'))
}

export const createFile = async (dir: string, relPath: string, content: string): Promise<void> => {
  const fullPath = join(dir, relPath, 'README.md')
  await mkdir(join(dir, relPath), { recursive: true })
  await writeFile(fullPath, content, 'utf-8')
}

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id: string | number
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export const connect = async (server: ChildProcess): Promise<void> => {
  const req: JsonRpcRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'aik-e2e-test', version: '1.0.0' },
    },
    id: 1,
  }
  server.stdin!.write(`${JSON.stringify(req)}\n`)

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('initialize timeout')), 5000)
    const onData = (chunk: Buffer) => {
      const text = chunk.toString()
      if (text.includes('"result"')) {
        clearTimeout(timeout)
        server.stdout!.off('data', onData)
        resolve()
      }
    }
    server.stdout!.on('data', onData)
  })

  const notif: JsonRpcRequest = {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    id: 2,
  }
  server.stdin!.write(`${JSON.stringify(notif)}\n`)
}

export const request = async (
  server: ChildProcess,
  method: string,
  params?: Record<string, unknown>
): Promise<unknown> => {
  const id = Math.floor(Math.random() * 1000000)
  const req: JsonRpcRequest = {
    jsonrpc: '2.0',
    method,
    params,
    id,
  }

  server.stdin!.write(`${JSON.stringify(req)}\n`)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`request timeout: ${method}`)), 5000)
    let buffer = ''
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      for (const line of lines.slice(0, -1)) {
        try {
          const resp: JsonRpcResponse = JSON.parse(line)
          if (resp.id === id) {
            clearTimeout(timeout)
            server.stdout!.off('data', onData)
            if (resp.error) {
              reject(new Error(resp.error.message))
            } else {
              resolve(resp.result)
            }
            return
          }
        } catch {
          /* partial line, keep waiting */
        }
      }
      buffer = lines[lines.length - 1] ?? ''
    }
    server.stdout!.on('data', onData)
  })
}

export const withServer = async <T>(
  contentDir: string,
  fn: (req: (method: string, params?: Record<string, unknown>) => Promise<unknown>) => Promise<T>,
  env: NodeJS.ProcessEnv = {}
): Promise<T> => {
  const proc = spawn(process.execPath, [distIndex, '--no-watch'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, AIK_CONTENT_DIR: contentDir, LOG_LEVEL: 'silent', ...env },
  })

  try {
    await connect(proc)
    return await fn((method, params) => request(proc, method, params))
  } finally {
    proc.kill('SIGKILL')
    await new Promise<void>(resolve => proc.on('exit', () => resolve()))
  }
}

export const runValidate = async (
  contentDir: string,
  extraArgs: string[] = []
): Promise<{ stdout: string; exitCode: number | null }> => {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [distIndex, '--no-watch', '--validate', ...extraArgs], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, AIK_CONTENT_DIR: contentDir, LOG_LEVEL: 'silent' },
    })

    const chunks: Buffer[] = []
    proc.stdout!.on('data', (chunk: Buffer) => chunks.push(chunk))
    proc.on('error', reject)

    proc.on('exit', exitCode => {
      resolve({ stdout: Buffer.concat(chunks).toString('utf-8'), exitCode })
    })

    setTimeout(() => {
      proc.kill()
      reject(new Error('validate timeout'))
    }, 10000)
  })
}
