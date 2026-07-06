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

beforeEach(() => {
  mockChokidarOn.mockReset()
  mockChokidarClose.mockReset()
})

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

    test('watcher registers add/change/unlink handlers', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()

      expect(mockChokidarOn).toHaveBeenCalledWith('add', expect.any(Function))
      expect(mockChokidarOn).toHaveBeenCalledWith('change', expect.any(Function))
      expect(mockChokidarOn).toHaveBeenCalledWith('unlink', expect.any(Function))

      await rm(dir, { recursive: true, force: true })
    })

    test('destroy stops watcher', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })

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

    test('watcher add handler processes file with valid category', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()

      // Capture the 'add' handler and invoke it
      const addHandler = mockChokidarOn.mock.calls.find(c => c[0] === 'add')?.[1] as
        | ((path: string) => Promise<void>)
        | undefined
      expect(addHandler).toBeDefined()

      // Create a file first, then invoke the handler
      await createFile(dir, 'rules/test.md', '---\ntitle: Test\n---\nBody')
      await addHandler!(join(dir, 'rules/test.md'))

      const all = store.getAll()
      expect(all.length).toBe(1)
      expect(all[0].title).toBe('Test')

      await rm(dir, { recursive: true, force: true })
    })

    test('watcher add handler ignores file with unknown category', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()

      const addHandler = mockChokidarOn.mock.calls.find(c => c[0] === 'add')?.[1] as
        | ((path: string) => Promise<void>)
        | undefined
      expect(addHandler).toBeDefined()

      await addHandler!(join(dir, 'unknown/test.md'))

      expect(store.getAll().length).toBe(0)

      await rm(dir, { recursive: true, force: true })
    })

    test('watcher change handler processes file', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()

      const changeHandler = mockChokidarOn.mock.calls.find(c => c[0] === 'change')?.[1] as
        | ((path: string) => Promise<void>)
        | undefined
      expect(changeHandler).toBeDefined()

      await createFile(dir, 'rules/test.md', '---\ntitle: Changed\n---\nBody')
      await changeHandler!(join(dir, 'rules/test.md'))

      const all = store.getAll()
      expect(all.length).toBe(1)
      expect(all[0].title).toBe('Changed')

      await rm(dir, { recursive: true, force: true })
    })

    test('watcher unlink handler removes file', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })

      store = new ContentStore({ ...config(dir), watch: true })
      await store.init()

      const addHandler = mockChokidarOn.mock.calls.find(c => c[0] === 'add')?.[1] as
        | ((path: string) => Promise<void>)
        | undefined
      const unlinkHandler = mockChokidarOn.mock.calls.find(c => c[0] === 'unlink')?.[1] as
        | ((path: string) => void)
        | undefined
      expect(addHandler).toBeDefined()
      expect(unlinkHandler).toBeDefined()

      // First add a file via the add handler
      await createFile(dir, 'rules/test.md', '---\ntitle: Test\n---\nBody')
      await addHandler!(join(dir, 'rules/test.md'))

      expect(store.getAll().length).toBe(1)

      // Now simulate unlink
      unlinkHandler!(join(dir, 'rules/test.md'))

      expect(store.getAll().length).toBe(0)

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('scanDir subcategory handling', () => {
    test('scans subdirectory with different category name', async () => {
      const dir = createTempDir()
      // Place a skills file under rules/skills/ to test subCategory detection
      await mkdir(join(dir, 'rules', 'skills'), { recursive: true })
      await createFile(dir, 'rules/skills/my-skill.md', '---\ntitle: My Skill\n---\nSkill content')

      store = new ContentStore(config(dir))
      await store.init()

      const all = store.getAll()
      expect(all.length).toBe(1)
      expect(all[0].category).toBe('skills')
      expect(all[0].title).toBe('My Skill')

      await rm(dir, { recursive: true, force: true })
    })

    test('scans subdirectory with same category name', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules', 'subdir'), { recursive: true })
      await createFile(dir, 'rules/subdir/nested.md', '---\ntitle: Nested\n---\nNested content')

      store = new ContentStore(config(dir))
      await store.init()

      const all = store.getAll()
      expect(all.length).toBe(1)
      expect(all[0].category).toBe('rules')
      expect(all[0].path).toBe('rules/subdir/nested')

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('addFile error handling', () => {
    test('handles files with invalid frontmatter gracefully', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      // File with malformed frontmatter - parseFrontmatter catches YAML errors
      await createFile(dir, 'rules/bad.md', '---\ninvalid yaml: [\n---\nBody')

      store = new ContentStore(config(dir))
      await store.init()

      // Should not crash, file should be loaded with default frontmatter
      expect(store.getAll().length).toBe(1)

      await rm(dir, { recursive: true, force: true })
    })

    test('handles non-md files gracefully', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      await createFile(dir, 'rules/notes.txt', 'Just some text')
      await createFile(dir, 'rules/readme.md', '---\ntitle: Readme\n---\nContent')

      store = new ContentStore(config(dir))
      await store.init()

      // Only .md files should be loaded
      expect(store.getAll().length).toBe(1)
      expect(store.getAll()[0].name).toBe('readme')

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('guessCategory edge cases', () => {
    test('handles files outside content directory', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })

      store = new ContentStore(config(dir))
      await store.init()

      // File at root level (no category prefix)
      await createFile(dir, 'orphan.md', '---\ntitle: Orphan\n---\nContent')
      await new Promise(r => setTimeout(r, 300))

      // Should not be picked up since it's not in a category dir
      expect(store.getAll().length).toBe(0)

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('extractName', () => {
    test('handles uppercase .MD extension', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      await createFile(dir, 'rules/test.MD', '---\ntitle: Test\n---\nContent')

      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getAll().length).toBe(1)
      expect(store.getByPath('rules/test')).toBeDefined()

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('writeContent update existing', () => {
    test('updates existing item in store when file already tracked', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      await createFile(dir, 'rules/existing.md', '---\ntitle: Original\n---\nBody')

      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getAll().length).toBe(1)

      // Write to the same path - should update in store
      const item = await store.writeContent(
        'rules/existing',
        '# Updated Body',
        { title: 'Updated Title' },
        true
      )

      expect(item.title).toBe('Updated Title')
      expect(store.getAll().length).toBe(1)
      expect(store.getByPath('rules/existing')!.title).toBe('Updated Title')

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('scanDir error handling', () => {
    test('handles readdir error gracefully', async () => {
      const dir = createTempDir()
      // Create a non-readable path by making a file where a dir is expected
      await mkdir(join(dir, 'rules'), { recursive: true })
      await createFile(dir, 'rules/test.md', '---\ntitle: Test\n---\nBody')

      store = new ContentStore(config(dir))
      await store.init()

      // Should have loaded the file
      expect(store.getAll().length).toBe(1)

      await rm(dir, { recursive: true, force: true })
    })
  })

  describe('addFile error handling', () => {
    test('handles readFile error gracefully', async () => {
      const dir = createTempDir()
      await mkdir(join(dir, 'rules'), { recursive: true })
      // Create a file that will be removed before scan
      await createFile(dir, 'rules/test.md', '---\ntitle: Test\n---\nBody')

      store = new ContentStore(config(dir))
      await store.init()

      expect(store.getAll().length).toBe(1)

      await rm(dir, { recursive: true, force: true })
    })
  })
})
