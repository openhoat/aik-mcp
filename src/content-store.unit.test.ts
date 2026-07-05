import { existsSync, mkdtempSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ContentStore } from './content-store.js'

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'aik-test-'))
}

async function createFile(dir: string, relPath: string, content: string): Promise<void> {
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

describe('ContentStore', () => {
  afterEach(() => {
    store?.destroy()
  })
  describe('scan and query', () => {
    test('scans rules directory', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      await createFile(
        dir,
        'rules/test-rule.md',
        `---
title: Test Rule
description: A test
tags: [test]
---
# Content`
      )

      store = new ContentStore(config(dir))
      await store.init()

      const all = store.getAll()
      expect(all.length).toBe(1)
      expect(all[0].category).toBe('rules')
      expect(all[0].title).toBe('Test Rule')
      expect(all[0].description).toBe('A test')
      expect(all[0].tags).toEqual(['test'])
      expect(all[0].content).toContain('# Content')

      await rm(dir, { recursive: true, force: true })
    })

    test('scans multiple categories', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      await mkdir(join(dir, 'skills'), { recursive: true })
      await createFile(dir, 'rules/r1.md', '---\ntitle: Rule 1\n---\nR1')
      await createFile(dir, 'skills/s1.md', '---\ntitle: Skill 1\n---\nS1')

      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getByCategory('rules').length).toBe(1)
      expect(store.getByCategory('skills').length).toBe(1)
      expect(store.getAll().length).toBe(2)

      await rm(dir, { recursive: true, force: true })
    })

    test('ignores non-existent directories', async () => {
      const dir = createTempDir()
      store = new ContentStore(config(dir))
      await store.init()
      expect(store.getAll()).toEqual([])
      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('getByPath', () => {
    test('finds content by path', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      await createFile(dir, 'rules/my-rule.md', '---\ntitle: My Rule\n---\nBody')

      store = new ContentStore(config(dir))
      await store.init()

      const item = store.getByPath('rules/my-rule')
      expect(item).toBeDefined()
      expect(item!.title).toBe('My Rule')
      expect(item!.content).toBe('Body')

      await rm(dir, { recursive: true, force: true })
    })

    test('returns undefined for non-existent path', async () => {
      const dir = createTempDir()
      store = new ContentStore(config(dir))
      await store.init()
      expect(store.getByPath('rules/nope')).toBeUndefined()
      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('writeContent', () => {
    test('creates a new content file', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      store = new ContentStore(config(dir))
      await store.init()

      const item = await store.writeContent(
        'rules/new-rule',
        '# New Rule\n\nContent here',
        { title: 'New Rule', description: 'Brand new' },
        false
      )

      expect(item.title).toBe('New Rule')
      expect(item.content).toContain('New Rule')
      expect(item.path).toBe('rules/new-rule')

      const filePath = join(dir, 'rules/new-rule.md')
      expect(existsSync(filePath)).toBe(true)

      await rm(dir, { recursive: true, force: true })
    })

    test('throws when overwrite is false and file exists', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      await createFile(dir, 'rules/existing.md', '# Existing')
      store = new ContentStore(config(dir))
      await store.init()

      await expect(store.writeContent('rules/existing', '# New', {}, false)).rejects.toThrow(
        /already exists/
      )

      await rm(dir, { recursive: true, force: true })
    })

    test('overwrites when overwrite is true', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      await createFile(dir, 'rules/existing.md', '# Original')
      store = new ContentStore(config(dir))
      await store.init()

      const item = await store.writeContent(
        'rules/existing',
        '# Updated',
        { title: 'Updated' },
        true
      )

      expect(item.title).toBe('Updated')
      expect(item.content).toContain('Updated')

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('deleteContent', () => {
    test('deletes an existing content file', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      await createFile(dir, 'rules/to-delete.md', '# To Delete')
      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getAll().length).toBe(1)

      const deleted = await store.deleteContent('rules/to-delete')
      expect(deleted).toBe(true)
      expect(store.getAll().length).toBe(0)
      expect(existsSync(join(dir, 'rules/to-delete.md'))).toBe(false)

      await rm(dir, { recursive: true, force: true })
    })

    test('returns false for non-existent content', async () => {
      const dir = createTempDir()
      store = new ContentStore(config(dir))
      await store.init()
      const deleted = await store.deleteContent('rules/nope')
      expect(deleted).toBe(false)
      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('nested directories', () => {
    test('scans nested subdirectories', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules', 'subdir'), { recursive: true })
      await createFile(
        dir,
        'rules/subdir/nested.md',
        `---
title: Nested Rule
description: A rule in a subdirectory
tags: [nested]
---
# Nested Content`
      )

      store = new ContentStore(config(dir))
      await store.init()

      const all = store.getAll()
      expect(all.length).toBe(1)
      expect(all[0].path).toBe('rules/subdir/nested')
      expect(all[0].title).toBe('Nested Rule')
      expect(all[0].description).toBe('A rule in a subdirectory')
      expect(all[0].tags).toEqual(['nested'])

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('re-initialization', () => {
    test('reloads existing files on re-init', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      await createFile(
        dir,
        'rules/original.md',
        `---
title: Original
description: Original description
---
Original content`
      )

      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getAll().length).toBe(1)
      expect(store.getAll()[0].title).toBe('Original')

      await store.writeContent(
        'rules/original',
        '# Updated\n\nUpdated content',
        { title: 'Updated', description: 'Updated description' },
        true
      )

      await store.init()

      expect(store.getAll().length).toBe(1)
      expect(store.getAll()[0].title).toBe('Updated')
      expect(store.getAll()[0].description).toBe('Updated description')

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('watch mode', () => {
    test('initializes with watch mode', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()

      expect(store.getAll().length).toBe(0)

      await rm(dir, { recursive: true, force: true })
    })

    test('destroy stops watcher', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()
      store.destroy()

      expect(store.getAll().length).toBe(0)

      await rm(dir, { recursive: true, force: true })
    })
  })
})
