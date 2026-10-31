import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
const WATCH_DEBOUNCE_MS = 300
const WATCH_READY_TIMEOUT_MS = 3000

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
  appliesTo: string[]
  requires: string[]
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
  return assets.sort((a, b) => a.localeCompare(b))
}

export class ContentStore {
  private items: ContentItem[] = []
  private readonly config: AikConfig
  private watcher: ReturnType<typeof watch> | null = null
  private scanTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: AikConfig) {
    this.config = config
  }

  async init(): Promise<void> {
    logger.info('scanning content directory...')
    await this.scan()
    logger.info({ itemCount: this.items.length }, 'scan complete')
    if (this.config.watch) {
      logger.info('file watching enabled')
      await this.startWatch()
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

  private async startWatch(): Promise<void> {
    // chokidar dropped glob support in 4.0: a pattern such as
    // `<dir>/<category>/*/**` is matched literally and never fires. Watch the
    // content root and let the recursive watch cover every category, including
    // the ones created after startup.
    this.watcher = watch(this.config.contentDir, {
      ignoreInitial: true,
      persistent: true,
    })

    this.watcher.on('all', () => this.scheduleScan())

    // chokidar attaches its directory watchers asynchronously: waiting for
    // `ready` closes the window where an external change (a git pull) would be
    // missed. The timeout keeps a missing content directory from blocking init.
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, WATCH_READY_TIMEOUT_MS)
      this.watcher?.once('ready', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  // A git checkout, an editor save or an asset batch emits a burst of events;
  // collapse them into a single rescan.
  private scheduleScan(): void {
    if (this.scanTimer) clearTimeout(this.scanTimer)
    this.scanTimer = setTimeout(() => {
      this.scanTimer = null
      logger.trace({}, 'content directory changed, rescanning')
      void this.scan().catch(err => logger.warn({ err }, 'rescan failed'))
    }, WATCH_DEBOUNCE_MS)
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

  // Read the raw entry file (frontmatter included) of a content bundle.
  readContent(path: string): string | null {
    const item = this.getByPath(path)
    if (!item) return null
    try {
      return readFileSync(item.fullPath, 'utf-8')
    } catch {
      return null
    }
  }

  // Read a supporting asset bundled with a content item.
  readAsset(path: string, asset: string): string | null {
    const item = this.getByPath(path)
    if (!item?.assets.includes(asset)) return null
    try {
      return readFileSync(join(dirname(item.fullPath), asset), 'utf-8')
    } catch {
      return null
    }
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
    // Safe: frontmatter normalized through frontmatterSchema
    const fmLines = ['---', serializeFrontmatter(frontmatter as Frontmatter), '---', '']
    const fileContent = fmLines.join('\n') + content.trimStart()

    await writeFile(fullPath, fileContent, 'utf-8')

    const { frontmatter: parsedFm, body } = parseFrontmatter(fileContent)
    const validCategory: Category = CATEGORIES.find(c => c === cat) ?? 'rules'
    const item: ContentItem = {
      path,
      fullPath,
      category: validCategory,
      ...parsedFm,
      name,
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
    if (this.scanTimer) {
      clearTimeout(this.scanTimer)
      this.scanTimer = null
    }
    if (this.watcher) {
      void this.watcher.close()
      this.watcher = null
    }
  }
}
