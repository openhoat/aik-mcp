import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { watch } from 'chokidar'
import type { AikConfig } from './config.js'
import { ContentError } from './errors.js'
import { type Frontmatter, parseFrontmatter, serializeFrontmatter } from './frontmatter.js'
import { logger } from './logger.js'

export type Category = 'rules' | 'skills' | 'workflows' | 'agents'

const CATEGORIES: Category[] = ['rules', 'skills', 'workflows', 'agents']
const ENTRY_FILE = 'README.md'

export interface ContentItem {
  path: string
  fullPath: string
  category: Category
  name: string
  title: string
  description: string
  tags: string[]
  version: string
  compatibility: string[]
  author: string
  created: string
  updated: string
  content: string
  assets: string[]
}

const listAssets = (bundleDir: string): string[] => {
  const assets: string[] = []
  const walk = (dir: string): void => {
    let entries: import('node:fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      const rel = relative(bundleDir, full)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && rel !== ENTRY_FILE) {
        assets.push(rel)
      }
    }
  }
  walk(bundleDir)
  return assets.sort()
}

export class ContentStore {
  private items: ContentItem[] = []
  private config: AikConfig
  private watcher: ReturnType<typeof watch> | null = null

  constructor(config: AikConfig) {
    this.config = config
  }

  async init(): Promise<void> {
    logger.info('scanning content directory...')
    await this.scan()
    logger.info({ itemCount: this.items.length }, 'scan complete')
    if (this.config.watch) {
      logger.info('file watching enabled')
      this.startWatch()
    }
  }

  private async scan(): Promise<void> {
    this.items = []
    for (const cat of CATEGORIES) {
      const catDir = join(this.config.contentDir, cat)
      if (!existsSync(catDir)) continue
      await this.scanCategory(catDir, cat)
    }
  }

  private async scanCategory(catDir: string, category: Category): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(catDir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const bundleDir = join(catDir, entry.name)
      const entryFile = join(bundleDir, ENTRY_FILE)
      if (!existsSync(entryFile)) continue
      await this.addBundle(bundleDir, entryFile, category, entry.name)
    }
  }

  private async addBundle(
    bundleDir: string,
    entryFile: string,
    category: Category,
    name: string
  ): Promise<void> {
    try {
      const raw = await readFile(entryFile, 'utf-8')
      const { frontmatter, body } = parseFrontmatter(raw)
      const item: ContentItem = {
        path: `${category}/${name}`,
        fullPath: entryFile,
        category,
        name,
        ...frontmatter,
        content: body,
        assets: listAssets(bundleDir),
      }

      const existingIndex = this.items.findIndex(i => i.fullPath === entryFile)
      if (existingIndex >= 0) {
        this.items[existingIndex] = item
      } else {
        this.items.push(item)
      }
    } catch (err) {
      logger.warn({ file: entryFile, err }, 'failed to load content bundle')
    }
  }

  private removeBundle(entryFile: string): void {
    this.items = this.items.filter(i => i.fullPath !== entryFile)
  }

  private startWatch(): void {
    const patterns = CATEGORIES.map(c => join(this.config.contentDir, c, '*', '**'))
    this.watcher = watch(patterns, {
      ignoreInitial: true,
      persistent: true,
    })

    this.watcher.on('all', async () => {
      logger.trace({}, 'content directory changed, rescanning')
      await this.scan()
    })
  }

  getAll(): ContentItem[] {
    return this.items
  }

  getByPath(path: string): ContentItem | undefined {
    const normalized = path.replace(/\.md$/i, '')
    return this.items.find(i => i.path === normalized)
  }

  getByCategory(category: Category): ContentItem[] {
    return this.items.filter(i => i.category === category)
  }

  async writeContent(
    path: string,
    content: string,
    frontmatter: Record<string, unknown>,
    overwrite: boolean
  ): Promise<ContentItem> {
    const [cat, ...rest] = path.split('/')
    const name = rest.join('/')
    const fullPath = join(this.config.contentDir, cat, name, ENTRY_FILE)
    if (!overwrite && existsSync(fullPath)) {
      throw new ContentError(
        'CONTENT_EXISTS',
        `Content at ${path} already exists (use overwrite: true to replace)`
      )
    }

    await mkdir(dirname(fullPath), { recursive: true })

    logger.info({ path, overwrite }, 'writing content')
    // Safe: frontmatter passed through schema validation
    const fmLines = ['---', serializeFrontmatter(frontmatter as Frontmatter), '---', '']
    const fileContent = fmLines.join('\n') + content.trimStart()

    await writeFile(fullPath, fileContent, 'utf-8')

    const { frontmatter: parsedFm, body } = parseFrontmatter(fileContent)
    const validCategory: Category = CATEGORIES.find(c => c === cat) ?? 'rules'
    const item: ContentItem = {
      path,
      fullPath,
      category: validCategory,
      name,
      ...parsedFm,
      content: body,
      assets: listAssets(dirname(fullPath)),
    }

    const existingIndex = this.items.findIndex(i => i.fullPath === fullPath)
    if (existingIndex >= 0) {
      this.items[existingIndex] = item
    } else {
      this.items.push(item)
    }

    return item
  }

  async deleteContent(path: string): Promise<boolean> {
    const item = this.getByPath(path)
    if (!item) return false

    logger.info({ path, file: item.fullPath }, 'deleting content')
    await rm(dirname(item.fullPath), { recursive: true, force: true })
    this.removeBundle(item.fullPath)
    return true
  }

  destroy(): void {
    if (this.watcher) {
      void this.watcher.close()
      this.watcher = null
    }
  }
}
