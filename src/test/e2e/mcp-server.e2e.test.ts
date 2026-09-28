import { readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createFile, createTempDir, runValidate, withServer } from '../helpers.js'

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
    'rules/test-rule',
    '---\ntitle: Test Rule\ntags: [test]\n---\n# Test Rule\n\ncontent'
  )
  await createFile(
    tempDir,
    'skills/test-skill',
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
    'rules/test-rule',
    '---\ntitle: Test Rule\ntags: [test]\n---\n# Test Rule'
  )
  await createFile(
    tempDir,
    'skills/test-skill',
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
  await createFile(tempDir, 'rules/test-rule', '---\ntitle: Test Rule\n---\n# Hello World')

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
    expect(result.isError).toBeTruthy()
  })
})

test('aik_search finds items by content', async () => {
  await createFile(tempDir, 'rules/test-rule', '---\ntitle: Test Rule\n---\n# UniqueSearchPhrase')

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
    'rules/existing',
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
  await createFile(tempDir, 'rules/to-delete', '---\ntitle: To Delete\n---\n# Delete Me')

  await withServer(tempDir, async req => {
    await req('tools/call', { name: 'delete', arguments: { path: 'rules/to-delete' } })

    const result = (await req('tools/call', {
      name: 'search',
      arguments: { query: 'Delete' },
    })) as { content: Array<{ text: string }> }
    expect(result.content[0].text).not.toContain('to-delete')
  })
})

test('aik_get_asset reads a bundle asset', async () => {
  await createFile(tempDir, 'skills/my-skill', '---\ntitle: My Skill\n---\n# My Skill')
  const assetPath = join(tempDir, 'skills', 'my-skill', 'assets', 'script.mjs')
  await mkdir(join(tempDir, 'skills', 'my-skill', 'assets'), { recursive: true })
  await writeFile(assetPath, 'export const hello = "world"\n', 'utf-8')

  await withServer(tempDir, async req => {
    const result = (await req('tools/call', {
      name: 'get_asset',
      arguments: { path: 'skills/my-skill', asset: 'assets/script.mjs' },
    })) as { content: Array<{ text: string }> }
    const text = result.content[0].text
    expect(text).toContain('"asset": "assets/script.mjs"')
    expect(text).toContain('hello')
  })
})

test('aik_get_asset returns error for unknown asset', async () => {
  await createFile(tempDir, 'skills/my-skill', '---\ntitle: My Skill\n---\n# My Skill')

  await withServer(tempDir, async req => {
    const result = (await req('tools/call', {
      name: 'get_asset',
      arguments: { path: 'skills/my-skill', asset: 'nope.mjs' },
    })) as { isError?: boolean; content: Array<{ text: string }> }
    expect(result.isError).toBeTruthy()
    expect(result.content[0].text).toContain('Asset not found')
  })
})

test('aik_install skill copies assets into SKILL.md bundle', async () => {
  await createFile(
    tempDir,
    'skills/my-skill',
    '---\ntitle: My Skill\ntags: [test]\n---\n# My Skill\ncontent'
  )
  await mkdir(join(tempDir, 'skills', 'my-skill', 'assets'), { recursive: true })
  await writeFile(
    join(tempDir, 'skills', 'my-skill', 'assets', 'run.sh'),
    '#!/bin/sh\necho hi\n',
    'utf-8'
  )
  await mkdir(join(tempDir, '.opencode'), { recursive: true })
  await writeFile(
    join(tempDir, '.opencode', 'opencode.jsonc'),
    JSON.stringify({}, null, 2),
    'utf-8'
  )

  await withServer(tempDir, async req => {
    const result = (await req('tools/call', {
      name: 'install',
      arguments: { path: 'skills/my-skill', projectDir: tempDir, agent: 'opencode' },
    })) as { content: Array<{ text: string }> }
    expect(JSON.parse(result.content[0].text).installed).toBe('skills/my-skill')

    const skillFile = join(tempDir, '.opencode', 'skills', 'my-skill', 'SKILL.md')
    const assetFile = join(tempDir, '.opencode', 'skills', 'my-skill', 'assets', 'run.sh')
    const skillContent = readFileSync(skillFile, 'utf-8')
    expect(skillContent).toContain('name: my-skill')
    expect(skillContent).toContain('tags')
    expect(readFileSync(assetFile, 'utf8')).toContain('echo hi')
  })
})

test('aik_list_installed returns installed items for opencode', async () => {
  await createFile(tempDir, 'rules/test-rule', '---\ntitle: Test Rule\n---\n# Test Rule\ncontent')
  await createFile(
    tempDir,
    'skills/test-skill',
    '---\ntitle: Test Skill\n---\n# Test Skill\ncontent'
  )

  await withServer(tempDir, async req => {
    const rulesDir = join(tempDir, '.opencode', 'rules')
    const skillsDir = join(tempDir, '.opencode', 'skills', 'test-skill')
    await mkdir(rulesDir, { recursive: true })
    await mkdir(skillsDir, { recursive: true })
    await writeFile(
      join(rulesDir, 'test-rule.md'),
      '---\ntitle: Test Rule\n---\n# Test Rule\ncontent',
      'utf-8'
    )
    await writeFile(
      join(skillsDir, 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test Skill\n---\n# Test Skill\ncontent',
      'utf-8'
    )
    await writeFile(
      join(tempDir, '.opencode', 'opencode.jsonc'),
      JSON.stringify({ instructions: ['.opencode/rules/test-rule.md'] }, null, 2),
      'utf-8'
    )

    const result = (await req('tools/call', {
      name: 'list_installed',
      arguments: { projectDir: tempDir, agent: 'opencode' },
    })) as { content: Array<{ text: string }> }

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.agent).toBe('opencode')
    expect(parsed.count).toBeGreaterThanOrEqual(2)
    expect(parsed.items).toEqual(
      expect.arrayContaining([
        { path: 'rules/test-rule' },
        expect.objectContaining({ path: 'skills/test-skill' }),
      ])
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
      arguments: { projectDir: tempDir, agent: 'opencode' },
    })) as { content: Array<{ text: string }> }

    expect(result.content[0].text).toContain('No aik-installed items found')
  })
})

test('aik_list_installed returns error when no config found', async () => {
  await withServer(tempDir, async req => {
    const result = (await req('tools/call', {
      name: 'list_installed',
      arguments: { projectDir: tempDir, agent: 'opencode' },
    })) as { isError?: boolean; content?: Array<{ text: string }> }

    if (result.content) {
      expect(result.content[0].text).toContain('No config file')
    }
  })
})

test('aik_reinstall reinstalls an item via opencode', async () => {
  await createFile(
    tempDir,
    'rules/test-rule',
    '---\ntitle: Test Rule\ntags: [test]\n---\n# Test Rule\n\nnew content'
  )

  await withServer(tempDir, async req => {
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
      arguments: { path: 'rules/test-rule', projectDir: tempDir, agent: 'opencode' },
    })) as { content: Array<{ text: string }> }

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.reinstalled).toBe('rules/test-rule')
    expect(parsed.agent).toBe('opencode')
    expect(parsed.hadPreviousInstall).toBe(true)

    const listResult = (await req('tools/call', {
      name: 'list_installed',
      arguments: { projectDir: tempDir, agent: 'opencode' },
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
      arguments: { path: 'rules/nonexistent', projectDir: tempDir, agent: 'opencode' },
    })) as { content: Array<{ text: string }> }

    expect(result.content[0].text).toContain('Content not found')
  })
})

test('--validate passes for valid content', async () => {
  await createFile(
    tempDir,
    'rules/test-rule',
    '---\ntitle: Test Rule\ndescription: A test\ntags: [test]\n---\n# Hello World'
  )

  const { stdout, exitCode } = await runValidate(tempDir)

  expect(exitCode).toBe(0)
  expect(stdout).toContain('✓')
  expect(stdout).toContain('1 valid, 0 invalid')
})

test('--validate fails for invalid content', async () => {
  await createFile(tempDir, 'rules/bad-rule', '---\ntitle: ""\ndescription: ""\ntags: []\n---\n')

  const { stdout, exitCode } = await runValidate(tempDir)

  expect(exitCode).toBe(1)
  expect(stdout).toContain('✗')
})

test('--validate --json outputs JSON', async () => {
  await createFile(
    tempDir,
    'rules/test-rule',
    '---\ntitle: Test Rule\ndescription: A test\ntags: [test]\n---\n# Hello World'
  )

  const { stdout, exitCode } = await runValidate(tempDir, ['--json'])

  expect(exitCode).toBe(0)
  const parsed = JSON.parse(stdout)
  expect(parsed).toMatchObject({ total: 1, valid: 1, invalid: 0 })
})

test('--validate --json outputs JSON with errors', async () => {
  await createFile(tempDir, 'rules/bad-rule', '---\ntitle: ""\ndescription: ""\ntags: []\n---\n')

  const { stdout, exitCode } = await runValidate(tempDir, ['--json'])

  expect(exitCode).toBe(1)
  const parsed = JSON.parse(stdout)
  expect(parsed.total).toBe(1)
  expect(parsed.invalid).toBe(1)
  expect(parsed.issues[0].errors.length).toBeGreaterThan(0)
})

test('handles concurrent requests', async () => {
  await createFile(tempDir, 'rules/a', '---\ntitle: A\n---\n# A')
  await createFile(tempDir, 'rules/b', '---\ntitle: B\n---\n# B')
  await createFile(tempDir, 'rules/c', '---\ntitle: C\n---\n# C')

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
