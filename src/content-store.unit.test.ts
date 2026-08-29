import { existsSync, mkdtempSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'

const mockChokidarOn = vi.fn()
const mockChokidarClose = vi.fn()

vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: mockChokidarOn,
    close: mockChokidarClose,
  })),
}))

import { ContentStore } from './content-store.js'

const createTempDir = (): string => {
  return mkdtempSync(join(tmpdir(), 'aik-test-'))
}

const createBundle = async (dir: string, relPath: string, content: string): Promise<void> => {
  const fullPath = join(dir, relPath, 'README.md')
  await mkdir(join(dir, relPath), { recursive: true })
  await writeFile(fullPath, content, 'utf-8')
}

const createAsset = async (dir: string, relPath: string, content: string): Promise<void> => {
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

beforeEach(() => {
  mockChokidarOn.mockReset()
  mockChokidarClose.mockReset()
})

describe('ContentStore', () => {
  afterEach(() => {
    store?.destroy()
  })
  describe('scan and query', () => {
    test('scans rules bundle', async () => {
      const dir = createTempDir()
      await createBundle(
        dir,
        'rules/test-rule',
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
      expect(all[0].path).toBe('rules/test-rule')
      expect(all[0].title).toBe('Test Rule')
      expect(all[0].description).toBe('A test')
      expect(all[0].tags).toEqual(['test'])
      expect(all[0].content).toContain('# Content')

      await rm(dir, { recursive: true, force: true })
    })

    test('scans multiple categories', async () => {
      const dir = createTempDir()
      await createBundle(dir, 'rules/r1', '---\ntitle: Rule 1\n---\nR1')
      await createBundle(dir, 'skills/s1', '---\ntitle: Skill 1\n---\nS1')

      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getByCategory('rules').length).toBe(1)
      expect(store.getByCategory('skills').length).toBe(1)
      expect(store.getAll().length).toBe(2)

      await rm(dir, { recursive: true, force: true })
    })

    test('ignores flat files without a bundle directory', async () => {
      const dir = createTempDir()
      await createBundle(dir, 'rules/r1', '---\ntitle: Rule 1\n---\nR1')
      await writeFile(join(dir, 'rules/flat.md'), '---\ntitle: Flat\n---\nBody')

      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getAll().length).toBe(1)
      expect(store.getByPath('rules/flat')).toBeUndefined()

      await rm(dir, { recursive: true, force: true })
    })

    test('ignores directories without README.md', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules', 'orphan'), { recursive: true })

      store = new ContentStore(config(dir))
      await store.init()
      expect(store.getAll()).toEqual([])
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

  describe('assets', () => {
    test('lists assets in a bundle', async () => {
      const dir = createTempDir()
      await createBundle(dir, 'skills/my-skill', '---\ntitle: My Skill\n---\nBody')
      await createAsset(dir, 'skills/my-skill/scripts/run.sh', '#!/bin/sh')
      await createAsset(dir, 'skills/my-skill/examples/example.md', '# Example')

      store = new ContentStore(config(dir))
      await store.init()

      const item = store.getByPath('skills/my-skill')
      expect(item).toBeDefined()
      expect(item!.assets).toEqual(['examples/example.md', 'scripts/run.sh'])

      await rm(dir, { recursive: true, force: true })
    })

    test('returns empty assets when bundle has only README', async () => {
      const dir = createTempDir()
      await createBundle(dir, 'rules/my-rule', '---\ntitle: My Rule\n---\nBody')

      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getByPath('rules/my-rule')!.assets).toEqual([])

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('getByPath', () => {
    test('finds content by path', async () => {
      const dir = createTempDir()
      await createBundle(dir, 'rules/my-rule', '---\ntitle: My Rule\n---\nBody')

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
    test('creates a new content bundle', async () => {
      const dir = createTempDir()
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

      const filePath = join(dir, 'rules/new-rule/README.md')
      expect(existsSync(filePath)).toBe(true)

      await rm(dir, { recursive: true, force: true })
    })

    test('throws when overwrite is false and file exists', async () => {
      const dir = createTempDir()
      await createBundle(dir, 'rules/existing', '# Existing')
      store = new ContentStore(config(dir))
      await store.init()

      await expect(store.writeContent('rules/existing', '# New', {}, false)).rejects.toThrow(
        /already exists/
      )

      await rm(dir, { recursive: true, force: true })
    })

    test('overwrites when overwrite is true', async () => {
      const dir = createTempDir()
      await createBundle(dir, 'rules/existing', '# Original')
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
    test('deletes an existing content bundle recursively', async () => {
      const dir = createTempDir()
      await createBundle(dir, 'rules/to-delete', '# To Delete')
      await createAsset(dir, 'rules/to-delete/assets/extra.md', '# Extra')
      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getAll().length).toBe(1)

      const deleted = await store.deleteContent('rules/to-delete')
      expect(deleted).toBe(true)
      expect(store.getAll().length).toBe(0)
      expect(existsSync(join(dir, 'rules/to-delete'))).toBe(false)

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

  describe('re-initialization', () => {
    test('reloads existing bundles on re-init', async () => {
      const dir = createTempDir()
      await createBundle(
        dir,
        'rules/original',
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

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()

      expect(store.getAll().length).toBe(0)

      await rm(dir, { recursive: true, force: true })
    })

    test('destroy stops watcher', async () => {
      const dir = createTempDir()

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()
      store.destroy()

      expect(store.getAll().length).toBe(0)

      await rm(dir, { recursive: true, force: true })
    })

    test('watcher registers all handler', async () => {
      const dir = createTempDir()

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()

      expect(mockChokidarOn).toHaveBeenCalledWith('all', expect.any(Function))

      await rm(dir, { recursive: true, force: true })
    })

    test('destroy stops watcher', async () => {
      const dir = createTempDir()

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()
      store.destroy()

      expect(mockChokidarClose).toHaveBeenCalled()

      await rm(dir, { recursive: true, force: true })
    })

    test('destroy on non-watch mode does not throw', async () => {
      const dir = createTempDir()
      store = new ContentStore(config(dir))
      await store.init()
      expect(() => store!.destroy()).not.toThrow()
      await rm(dir, { recursive: true, force: true })
    })

    test('watcher all handler rescans content', async () => {
      const dir = createTempDir()

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()

      const allHandler = mockChokidarOn.mock.calls.find(c => c[0] === 'all')?.[1] as
        | (() => Promise<void>)
        | undefined
      expect(allHandler).toBeDefined()

      await createBundle(dir, 'rules/test', '---\ntitle: Test\n---\nBody')
      await allHandler!()

      const all = store.getAll()
      expect(all.length).toBe(1)
      expect(all[0].title).toBe('Test')

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('addBundle error handling', () => {
    test('handles files with invalid frontmatter gracefully', async () => {
      const dir = createTempDir()
      await createBundle(dir, 'rules/bad', '---\ninvalid yaml: [\n---\nBody')

      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getAll().length).toBe(1)

      await rm(dir, { recursive: true, force: true })
    })

    test('handles non-md entry files gracefully', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules', 'notes'), { recursive: true })
      await writeFile(join(dir, 'rules/notes/notes.txt'), 'Just some text')

      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getAll().length).toBe(0)

      await rm(dir, { recursive: true, force: true })
    })
  })
})
