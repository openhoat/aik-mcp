import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative } from 'node:path'
import { watch } from 'chokidar'
import type { AikConfig } from './config.js'
import { ContentError } from './errors.js'
import { type Frontmatter, parseFrontmatter, serializeFrontmatter } from './frontmatter.js'
import { logger } from './logger.js'

export type Category = 'rules' | 'skills' | 'workflows' | 'agents' | 'commands' | 'templates'

const CATEGORIES: Category[] = ['rules', 'skills', 'workflows', 'agents', 'commands', 'templates']

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
}

const categoryFromDir = (dir: string): Category | null => {
  const base = dir.split('/').pop() ?? dir
  const safeCategory = CATEGORIES.find(c => c === base)
  if (safeCategory) return safeCategory
  return null
}

const extractName = (filePath: string, baseDir: string): string => {
  const rel = relative(baseDir, filePath)
  return rel.replace(/\.md$/i, '')
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
      await this.scanDir(catDir, cat)
    }
  }

  private async scanDir(dirPath: string, category: Category): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(dirPath, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        const subCategory = categoryFromDir(join(category, entry.name))
        if (subCategory && subCategory !== category) {
          await this.scanDir(fullPath, subCategory)
        } else {
          await this.scanDir(fullPath, category)
        }
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
        await this.addFile(fullPath, category)
      }
    }
  }

  private async addFile(fullPath: string, category: Category): Promise<void> {
    try {
      const raw = await readFile(fullPath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter(raw)
      const relPath = extractName(fullPath, this.config.contentDir)

      const item: ContentItem = {
        path: relPath,
        fullPath,
        category,
        name: relPath.split('/').pop() ?? relPath,
        ...frontmatter,
        content: body,
      }

      const existingIndex = this.items.findIndex(i => i.fullPath === fullPath)
      if (existingIndex >= 0) {
        this.items[existingIndex] = item
      } else {
        this.items.push(item)
      }
    } catch (err) {
      logger.warn({ file: fullPath, err }, 'failed to load content file')
    }
  }

  private removeFile(fullPath: string): void {
    this.items = this.items.filter(i => i.fullPath !== fullPath)
  }

  private startWatch(): void {
    const patterns = CATEGORIES.map(c => join(this.config.contentDir, c, '**/*.md'))
    this.watcher = watch(patterns, {
      ignoreInitial: true,
      persistent: true,
    })

    this.watcher.on('add', async filePath => {
      const cat = this.guessCategory(filePath)
      logger.trace({ file: filePath, category: cat }, 'file added')
      if (cat) await this.addFile(filePath, cat)
    })

    this.watcher.on('change', async filePath => {
      const cat = this.guessCategory(filePath)
      logger.trace({ file: filePath, category: cat }, 'file changed')
      if (cat) await this.addFile(filePath, cat)
    })

    this.watcher.on('unlink', filePath => {
      logger.trace({ file: filePath }, 'file removed')
      this.removeFile(filePath)
    })
  }

  private guessCategory(filePath: string): Category | null {
    const rel = relative(this.config.contentDir, filePath)
    const parts = rel.split('/')
    if (parts.length > 0) {
      const cat = categoryFromDir(parts[0])
      if (cat) return cat
      if (parts.length > 1) {
        const sub = categoryFromDir(parts[1])
        if (sub) return sub
      }
    }
    return null
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
    const fullPath = join(this.config.contentDir, `${path}.md`)
    if (!overwrite && existsSync(fullPath)) {
      throw new ContentError(
        'CONTENT_EXISTS',
        `Content at ${path}.md already exists (use overwrite: true to replace)`
      )
    }

    await mkdir(dirname(fullPath), { recursive: true })

    logger.info({ path, overwrite }, 'writing content')
    // Safe: frontmatter passed through schema validation
    const fmLines = ['---', serializeFrontmatter(frontmatter as Frontmatter), '---', '']
    const fileContent = fmLines.join('\n') + content.trimStart()

    await writeFile(fullPath, fileContent, 'utf-8')

    const { frontmatter: parsedFm, body } = parseFrontmatter(fileContent)
    const relPath = extractName(fullPath, this.config.contentDir)
    const pathCategory = path.split('/')[0]
    const validCategory: Category = CATEGORIES.find(c => c === pathCategory) ?? 'rules'
    const item: ContentItem = {
      path: relPath,
      fullPath,
      category: validCategory,
      name: relPath.split('/').pop() ?? relPath,
      ...parsedFm,
      content: body,
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
    await unlink(item.fullPath)
    this.removeFile(item.fullPath)
    return true
  }

  destroy(): void {
    if (this.watcher) {
      void this.watcher.close()
      this.watcher = null
    }
  }
}
