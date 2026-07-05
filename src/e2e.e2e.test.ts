import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distIndex = resolve(__dirname, '../build/index.js')

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'aik-e2e-'))
}

async function createFile(dir: string, relPath: string, content: string): Promise<void> {
  const fullPath = join(dir, relPath)
  await mkdir(fullPath.replace(/\/[^/]+$/, ''), { recursive: true })
  await writeFile(fullPath, content, 'utf-8')
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id: string | number
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

async function connect(server: ChildProcess): Promise<void> {
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

  // send initialized notification
  const notif: JsonRpcRequest = {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    id: 2,
  }
  server.stdin!.write(`${JSON.stringify(notif)}\n`)
}

async function request(
  server: ChildProcess,
  method: string,
  params?: Record<string, unknown>
): Promise<unknown> {
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

async function withServer<T>(
  contentDir: string,
  fn: (req: (method: string, params?: Record<string, unknown>) => Promise<unknown>) => Promise<T>
): Promise<T> {
  const proc = spawn(process.execPath, [distIndex, '--no-watch'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, AIK_CONTENT_DIR: contentDir, LOG_LEVEL: 'silent' },
  })

  try {
    await connect(proc)
    return await fn((method, params) => request(proc, method, params))
  } finally {
    proc.kill('SIGKILL')
    await new Promise<void>(resolve => proc.on('exit', () => resolve()))
  }
}

let tempDir: string

beforeEach(() => {
  tempDir = createTempDir()
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

test('aik_list returns all items', async () => {
  await createFile(
    tempDir,
    'rules/test-rule.md',
    '---\ntitle: Test Rule\ntags: [test]\n---\n# Test Rule\n\ncontent'
  )
  await createFile(
    tempDir,
    'skills/test-skill.md',
    '---\ntitle: Test Skill\ntags: [test]\n---\n# Test Skill\n\ncontent'
  )

  await withServer(tempDir, async req => {
    const result = (await req('tools/call', { name: 'list', arguments: {} })) as {
      content: Array<{ text: string }>
    }
    const text = result.content[0].text
    expect(text).toContain('test-rule')
    expect(text).toContain('test-skill')
  })
})

test('aik_list filters by category', async () => {
  await createFile(
    tempDir,
    'rules/test-rule.md',
    '---\ntitle: Test Rule\ntags: [test]\n---\n# Test Rule'
  )
  await createFile(
    tempDir,
    'skills/test-skill.md',
    '---\ntitle: Test Skill\ntags: [test]\n---\n# Test Skill'
  )

  await withServer(tempDir, async req => {
    const result = (await req('tools/call', {
      name: 'list',
      arguments: { category: 'rules' },
    })) as { content: Array<{ text: string }> }
    const text = result.content[0].text
    expect(text).toContain('test-rule')
    expect(text).not.toContain('test-skill')
  })
})

test('aik_get retrieves a specific item', async () => {
  await createFile(tempDir, 'rules/test-rule.md', '---\ntitle: Test Rule\n---\n# Hello World')

  await withServer(tempDir, async req => {
    const result = (await req('tools/call', {
      name: 'get',
      arguments: { path: 'rules/test-rule' },
    })) as { content: Array<{ text: string }> }
    const text = result.content[0].text
    expect(text).toContain('Hello World')
  })
})

test('aik_get returns error for missing path', async () => {
  await withServer(tempDir, async req => {
    const result = (await req('tools/call', {
      name: 'get',
      arguments: { path: 'nonexistent' },
    })) as { content: Array<{ text: string }>; isError?: boolean }
    expect((result as any).isError).toBeTruthy()
  })
})

test('aik_search finds items by content', async () => {
  await createFile(
    tempDir,
    'rules/test-rule.md',
    '---\ntitle: Test Rule\n---\n# UniqueSearchPhrase'
  )

  await withServer(tempDir, async req => {
    const result = (await req('tools/call', {
      name: 'search',
      arguments: { query: 'UniqueSearchPhrase' },
    })) as { content: Array<{ text: string }> }
    const text = result.content[0].text
    expect(text).toContain('test-rule')
  })
})

test('aik_write creates a new item', async () => {
  await withServer(tempDir, async req => {
    await req('tools/call', {
      name: 'write',
      arguments: {
        path: 'rules/new-rule',
        content: '# Fresh Rule',
        title: 'Fresh Rule',
        description: 'A freshly created rule',
        tags: ['test'],
      },
    })

    const result = (await req('tools/call', {
      name: 'get',
      arguments: { path: 'rules/new-rule' },
    })) as { content: Array<{ text: string }> }
    expect(result.content[0].text).toContain('Fresh Rule')
  })
})

test('aik_write overwrites existing item', async () => {
  await createFile(
    tempDir,
    'rules/existing.md',
    '---\ntitle: Old\ndescription: Old desc\ntags: [test]\n---\n# Old Content'
  )

  await withServer(tempDir, async req => {
    await req('tools/call', {
      name: 'write',
      arguments: {
        path: 'rules/existing',
        content: '# Updated Content',
        title: 'Updated',
        description: 'Updated desc',
        tags: ['test'],
        overwrite: true,
      },
    })

    const result = (await req('tools/call', {
      name: 'get',
      arguments: { path: 'rules/existing' },
    })) as { content: Array<{ text: string }> }
    expect(result.content[0].text).toContain('Updated Content')
    expect(result.content[0].text).not.toContain('Old Content')
  })
})

test('aik_delete removes an item', async () => {
  await createFile(tempDir, 'rules/to-delete.md', '---\ntitle: To Delete\n---\n# Delete Me')

  await withServer(tempDir, async req => {
    await req('tools/call', { name: 'delete', arguments: { path: 'rules/to-delete' } })

    const result = (await req('tools/call', {
      name: 'search',
      arguments: { query: 'Delete' },
    })) as { content: Array<{ text: string }> }
    expect(result.content[0].text).not.toContain('to-delete')
  })
})

test('aik_list_installed returns installed items for opencode', async () => {
  await createFile(
    tempDir,
    'rules/test-rule.md',
    '---\ntitle: Test Rule\n---\n# Test Rule\ncontent'
  )
  await createFile(
    tempDir,
    'skills/test-skill.md',
    '---\ntitle: Test Skill\n---\n# Test Skill\ncontent'
  )

  await withServer(tempDir, async req => {
    const configDir = join(tempDir, '.opencode')
    await mkdir(configDir, { recursive: true })
    await writeFile(
      join(configDir, 'opencode.jsonc'),
      JSON.stringify(
        { instructions: ['.opencode/rules/test-rule.md', '.opencode/skills/test-skill.md'] },
        null,
        2
      ),
      'utf-8'
    )

    const result = (await req('tools/call', {
      name: 'list_installed',
      arguments: { projectDir: tempDir },
    })) as { content: Array<{ text: string }> }

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.agent).toBe('opencode')
    expect(parsed.count).toBe(2)
    expect(parsed.items).toEqual(
      expect.arrayContaining([{ path: 'rules/test-rule' }, { path: 'skills/test-skill' }])
    )
  })
})

test('aik_list_installed returns empty when nothing installed', async () => {
  await withServer(tempDir, async req => {
    const configDir = join(tempDir, '.opencode')
    await mkdir(configDir, { recursive: true })
    await writeFile(
      join(configDir, 'opencode.jsonc'),
      JSON.stringify({ instructions: [] }, null, 2),
      'utf-8'
    )

    const result = (await req('tools/call', {
      name: 'list_installed',
      arguments: { projectDir: tempDir },
    })) as { content: Array<{ text: string }> }

    expect(result.content[0].text).toContain('No aik-installed items found')
  })
})

test('aik_list_installed returns error when no config found', async () => {
  await withServer(tempDir, async req => {
    const result = (await req('tools/call', {
      name: 'list_installed',
      arguments: { projectDir: tempDir },
    })) as { isError?: boolean; content?: Array<{ text: string }> }

    if (result.content) {
      expect(result.content[0].text).toContain('No config file')
    }
  })
})

test('aik_reinstall reinstalls an item via opencode', async () => {
  await createFile(
    tempDir,
    'rules/test-rule.md',
    '---\ntitle: Test Rule\ntags: [test]\n---\n# Test Rule\n\nnew content'
  )

  await withServer(tempDir, async req => {
    // pre-seed opencode config with the item already installed
    const configDir = join(tempDir, '.opencode', 'rules')
    await mkdir(configDir, { recursive: true })
    await writeFile(
      join(tempDir, '.opencode', 'rules', 'test-rule.md'),
      '---\ntitle: Test Rule\n---\n# Test Rule\n\nold content',
      'utf-8'
    )
    await writeFile(
      join(tempDir, '.opencode', 'opencode.jsonc'),
      JSON.stringify({ instructions: ['.opencode/rules/test-rule.md'] }, null, 2),
      'utf-8'
    )

    const result = (await req('tools/call', {
      name: 'reinstall',
      arguments: { path: 'rules/test-rule', projectDir: tempDir },
    })) as { content: Array<{ text: string }> }

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.reinstalled).toBe('rules/test-rule')
    expect(parsed.agent).toBe('opencode')
    expect(parsed.hadPreviousInstall).toBe(true)

    // verify the config entry still exists after reinstall
    const listResult = (await req('tools/call', {
      name: 'list_installed',
      arguments: { projectDir: tempDir },
    })) as { content: Array<{ text: string }> }
    const listed = JSON.parse(listResult.content[0].text)
    expect(listed.count).toBe(1)
    expect(listed.items).toContainEqual({ path: 'rules/test-rule' })
  })
})

test('aik_reinstall returns error for missing content', async () => {
  await withServer(tempDir, async req => {
    const configDir = join(tempDir, '.opencode')
    await mkdir(configDir, { recursive: true })
    await writeFile(
      join(configDir, 'opencode.jsonc'),
      JSON.stringify({ instructions: [] }, null, 2),
      'utf-8'
    )

    const result = (await req('tools/call', {
      name: 'reinstall',
      arguments: { path: 'rules/nonexistent', projectDir: tempDir },
    })) as { content: Array<{ text: string }> }

    expect(result.content[0].text).toContain('Content not found')
  })
})

test('handles concurrent requests', async () => {
  await createFile(tempDir, 'rules/a.md', '---\ntitle: A\n---\n# A')
  await createFile(tempDir, 'rules/b.md', '---\ntitle: B\n---\n# B')
  await createFile(tempDir, 'rules/c.md', '---\ntitle: C\n---\n# C')

  await withServer(tempDir, async req => {
    const results = await Promise.all([
      req('tools/call', { name: 'get', arguments: { path: 'rules/a' } }),
      req('tools/call', { name: 'get', arguments: { path: 'rules/b' } }),
      req('tools/call', { name: 'get', arguments: { path: 'rules/c' } }),
    ])
    for (const r of results) {
      expect(r).toBeDefined()
    }
  })
})
