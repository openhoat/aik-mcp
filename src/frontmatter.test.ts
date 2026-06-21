import { frontmatterSchema, parseFrontmatter, serializeFrontmatter } from './frontmatter'

describe('parseFrontmatter', () => {
  it('parses full frontmatter with all fields', () => {
    const raw = `---
title: Test Rule
description: A test rule description
tags: [typescript, test]
version: 2.0.0
compatibility: [opencode, claude-code]
author: test-user
created: 2026-01-01
updated: 2026-06-21
---

# Content body

Some content here.`

    const result = parseFrontmatter(raw)
    expect(result.frontmatter.title).toBe('Test Rule')
    expect(result.frontmatter.description).toBe('A test rule description')
    expect(result.frontmatter.tags).toEqual(['typescript', 'test'])
    expect(result.frontmatter.version).toBe('2.0.0')
    expect(result.frontmatter.compatibility).toEqual(['opencode', 'claude-code'])
    expect(result.frontmatter.author).toBe('test-user')
    expect(result.frontmatter.created).toBe('2026-01-01')
    expect(result.frontmatter.updated).toBe('2026-06-21')
    expect(result.body).toContain('# Content body')
    expect(result.body).toContain('Some content here.')
  })

  it('returns defaults when no frontmatter', () => {
    const raw = '# No Frontmatter\n\nJust content.'
    const result = parseFrontmatter(raw)
    expect(result.frontmatter.title).toBe('')
    expect(result.frontmatter.tags).toEqual([])
    expect(result.frontmatter.version).toBe('1.0.0')
    expect(result.body).toBe('# No Frontmatter\n\nJust content.')
  })

  it('parses partial frontmatter', () => {
    const raw = `---
title: Partial
tags: [one]
---

Body text`

    const result = parseFrontmatter(raw)
    expect(result.frontmatter.title).toBe('Partial')
    expect(result.frontmatter.tags).toEqual(['one'])
    expect(result.frontmatter.description).toBe('')
    expect(result.frontmatter.version).toBe('1.0.0')
    expect(result.body).toBe('Body text')
  })

  it('handles malformed YAML gracefully', () => {
    const raw = `---
title: unclosed string
invalid: [broken
---

Body`
    const result = parseFrontmatter(raw)
    expect(result.body).toBe('Body')
    expect(typeof result.frontmatter.title).toBe('string')
  })

  it('handles empty file', () => {
    const result = parseFrontmatter('')
    expect(result.frontmatter.title).toBe('')
    expect(result.body).toBe('')
  })

  it('handles file with only frontmatter', () => {
    const raw = `---
title: Just Frontmatter
---

`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter.title).toBe('Just Frontmatter')
    expect(result.body).toBe('')
  })

  it('strips leading whitespace before frontmatter', () => {
    const raw = `


---
title: Leading Whitespace
---

Body`

    const result = parseFrontmatter(raw)
    expect(result.frontmatter.title).toBe('Leading Whitespace')
    expect(result.body).toBe('Body')
  })
})

describe('serializeFrontmatter', () => {
  it('serializes non-empty fields', () => {
    const fm = frontmatterSchema.parse({
      title: 'Test',
      tags: ['a', 'b'],
      version: '1.0.0',
    })
    const result = serializeFrontmatter(fm)
    expect(result).toContain('title: Test')
    expect(result).toContain('tags:')
    expect(result).toContain('- a')
    expect(result).toContain('- b')
  })

  it('omits empty fields', () => {
    const fm = frontmatterSchema.parse({})
    const result = serializeFrontmatter(fm)
    expect(result).not.toContain('title:')
    expect(result).not.toContain('description:')
  })
})
