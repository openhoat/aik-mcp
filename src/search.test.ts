import type { ContentItem } from './content-store.js'
import { SearchEngine } from './search.js'

function makeItem(overrides: Partial<ContentItem>): ContentItem {
  return {
    path: 'test/item',
    fullPath: '/tmp/test/item.md',
    category: 'rules',
    name: 'item',
    title: '',
    description: '',
    tags: [],
    version: '1.0.0',
    compatibility: ['opencode'],
    author: '',
    created: '',
    updated: '',
    content: '',
    ...overrides,
  }
}

describe('SearchEngine', () => {
  test('returns empty for empty index', () => {
    const engine = new SearchEngine()
    engine.buildIndex([])
    expect(engine.search({ query: 'test' })).toEqual([])
  })

  test('finds items by title', () => {
    const engine = new SearchEngine()
    const items = [
      makeItem({ path: 'rules/ts', title: 'TypeScript Rules', content: 'Some content' }),
      makeItem({ path: 'rules/js', title: 'JavaScript Rules', content: 'Other content' }),
    ]
    engine.buildIndex(items)

    const results = engine.search({ query: 'TypeScript' })
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].item.path).toBe('rules/ts')
  })

  test('finds items by description', () => {
    const engine = new SearchEngine()
    const items = [
      makeItem({ path: 'rules/err', description: 'How to handle errors in production' }),
      makeItem({ path: 'rules/lint', description: 'Linting configuration' }),
    ]
    engine.buildIndex(items)

    const results = engine.search({ query: 'errors' })
    expect(results.some((r: { item: { path: string } }) => r.item.path === 'rules/err')).toBe(true)
  })

  test('finds items by tags', () => {
    const engine = new SearchEngine()
    const items = [
      makeItem({ path: 'rules/sec', tags: ['security', 'authentication'] }),
      makeItem({ path: 'rules/perf', tags: ['performance', 'optimization'] }),
    ]
    engine.buildIndex(items)

    const results = engine.search({ query: 'security' })
    expect(results.some((r: { item: { path: string } }) => r.item.path === 'rules/sec')).toBe(true)
  })

  test('filters by category', () => {
    const engine = new SearchEngine()
    const items = [
      makeItem({ path: 'rules/r1', category: 'rules', title: 'test' }),
      makeItem({ path: 'skills/s1', category: 'skills', title: 'test' }),
    ]
    engine.buildIndex(items)

    const results = engine.search({ query: 'test', category: 'skills' })
    expect(results.length).toBe(1)
    expect(results[0].item.category).toBe('skills')
  })

  test('respects limit parameter', () => {
    const engine = new SearchEngine()
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ path: `rules/r${i}`, title: 'test' })
    )
    engine.buildIndex(items)

    const results = engine.search({ query: 'test', limit: 3 })
    expect(results.length).toBe(3)
  })

  test('returns sorted by relevance (best score first)', () => {
    const engine = new SearchEngine()
    const items = [
      makeItem({ path: 'rules/exact', title: 'typescript coding standards' }),
      makeItem({
        path: 'rules/partial',
        title: 'Some Typescript guidelines',
        description: 'about typescript',
      }),
      makeItem({ path: 'rules/unrelated', title: 'Other rules', description: 'nothing here' }),
    ]
    engine.buildIndex(items)

    const results = engine.search({ query: 'typescript' })
    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results[0].score).toBeLessThanOrEqual(results[1].score)
  })
})
