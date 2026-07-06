import { mkdtempSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ContentStore } from './content-store.js'
import { formatResult, validateContent } from './validate.js'

const createTempDir = (): string => {
  return mkdtempSync(join(tmpdir(), 'aik-test-'))
}

const createFile = async (dir: string, relPath: string, content: string): Promise<void> => {
  const fullPath = join(dir, relPath)
  await mkdir(fullPath.replace(/\/[^/]+$/, ''), { recursive: true })
  await writeFile(fullPath, content, 'utf-8')
}

const config = (dir: string) => ({
  contentDir: dir,
  http: false,
  port: 0,
  watch: false,
  validate: false,
  json: false,
})

let store: ContentStore | undefined

describe('validateContent', () => {
  afterEach(() => {
    store?.destroy()
  })

  test('returns valid for all items with correct frontmatter', async () => {
    const dir = createTempDir()
    await mkdir(join(dir, 'rules'), { recursive: true })
    await createFile(
      dir,
      'rules/valid-rule.md',
      `---
title: Valid Rule
description: A valid rule
tags: [test]
---
# Content`
    )

    store = new ContentStore(config(dir))
    await store.init()
    const result = validateContent(store)

    expect(result.total).toBe(1)
    expect(result.valid).toBe(1)
    expect(result.invalid).toBe(0)
    expect(result.issues).toHaveLength(0)

    await rm(dir, { recursive: true, force: true })
  })

  test('detects missing title', async () => {
    const dir = createTempDir()
    await mkdir(join(dir, 'rules'), { recursive: true })
    await createFile(
      dir,
      'rules/no-title.md',
      `---
description: Desc
tags: [t]
---
# Body`
    )

    store = new ContentStore(config(dir))
    await store.init()
    const result = validateContent(store)

    expect(result.valid).toBe(0)
    expect(result.invalid).toBe(1)
    expect(result.issues[0].errors.some(e => e.includes('title'))).toBe(true)

    await rm(dir, { recursive: true, force: true })
  })

  test('detects empty body', async () => {
    const dir = createTempDir()
    await mkdir(join(dir, 'rules'), { recursive: true })
    await createFile(
      dir,
      'rules/empty-body.md',
      `---
title: Empty Body
description: Desc
tags: [t]
---
`
    )

    store = new ContentStore(config(dir))
    await store.init()
    const result = validateContent(store)

    expect(result.invalid).toBe(1)
    expect(result.issues[0].errors.some(e => e.includes('body'))).toBe(true)

    await rm(dir, { recursive: true, force: true })
  })

  test('returns empty result for empty store', async () => {
    const dir = createTempDir()
    store = new ContentStore(config(dir))
    await store.init()
    const result = validateContent(store)

    expect(result.total).toBe(0)
    expect(result.valid).toBe(0)
    expect(result.invalid).toBe(0)
    expect(result.issues).toHaveLength(0)

    await rm(dir, { recursive: true, force: true })
  })

  test('mixes valid and invalid items', async () => {
    const dir = createTempDir()
    await mkdir(join(dir, 'rules'), { recursive: true })
    await createFile(
      dir,
      'rules/valid.md',
      `---
title: Valid
description: Desc
tags: [t]
---
# Body`
    )
    await createFile(
      dir,
      'rules/invalid.md',
      `---
description: Desc
tags: [t]
---
# Body`
    )

    store = new ContentStore(config(dir))
    await store.init()
    const result = validateContent(store)

    expect(result.total).toBe(2)
    expect(result.valid).toBe(1)
    expect(result.invalid).toBe(1)

    await rm(dir, { recursive: true, force: true })
  })
})

describe('formatResult', () => {
  test('formats as JSON when json flag is true', () => {
    const result = {
      total: 2,
      valid: 1,
      invalid: 1,
      issues: [{ path: 'rules/broken', errors: ['title: title is required'] }],
    }
    const output = formatResult(result, ['rules/ok', 'rules/broken'], true)
    const parsed = JSON.parse(output)
    expect(parsed.total).toBe(2)
    expect(parsed.valid).toBe(1)
    expect(parsed.issues).toHaveLength(1)
  })

  test('formats as text when json flag is false', () => {
    const result = {
      total: 2,
      valid: 1,
      invalid: 1,
      issues: [{ path: 'rules/broken', errors: ['title: title is required'] }],
    }
    const output = formatResult(result, ['rules/ok', 'rules/broken'], false)
    expect(output).toContain('✓ rules/ok')
    expect(output).toContain('✗ rules/broken')
    expect(output).toContain('1 valid')
    expect(output).toContain('1 invalid')
  })

  test('shows only valid items when no issues', () => {
    const result = { total: 1, valid: 1, invalid: 0, issues: [] }
    const output = formatResult(result, ['rules/ok'], false)
    expect(output).toContain('✓ rules/ok')
    expect(output).toContain('1 valid')
    expect(output).toContain('0 invalid')
  })
})
