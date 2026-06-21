import Fuse from 'fuse.js'
import type { ContentItem } from './content-store.js'

export interface SearchOptions {
  query: string
  category?: string
  limit?: number
}

export interface SearchResult {
  item: ContentItem
  score: number
}

export class SearchEngine {
  private fuse: Fuse<ContentItem> | null = null

  buildIndex(items: ContentItem[]): void {
    this.fuse = new Fuse(items, {
      keys: [
        { name: 'title', weight: 3 },
        { name: 'description', weight: 2 },
        { name: 'tags', weight: 2 },
        { name: 'content', weight: 1 },
        { name: 'name', weight: 2 },
        { name: 'path', weight: 1 },
      ],
      threshold: 0.4,
      includeScore: true,
      shouldSort: true,
      minMatchCharLength: 2,
    })
  }

  search(options: SearchOptions): SearchResult[] {
    if (!this.fuse) return []

    let results = this.fuse.search(options.query)

    if (options.category) {
      results = results.filter(r => r.item.category === options.category)
    }

    const limit = options.limit ?? 20
    results = results.slice(0, limit)

    return results.map(r => ({
      item: r.item,
      score: r.score ?? 1,
    }))
  }
}
