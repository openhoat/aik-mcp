import {
  frontmatterSchema,
  parseFrontmatter,
  serializeFrontmatter,
  validateFrontmatter,
} from './frontmatter.js'

describe('parseFrontmatter', () => {
  test('parses full frontmatter with all fields', () => {
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

  test('returns defaults when no frontmatter', () => {
    const raw = '# No Frontmatter\n\nJust content.'
    const result = parseFrontmatter(raw)
    expect(result.frontmatter.title).toBe('')
    expect(result.frontmatter.tags).toEqual([])
    expect(result.frontmatter.version).toBe('1.0.0')
    expect(result.body).toBe('# No Frontmatter\n\nJust content.')
  })

  test('parses partial frontmatter', () => {
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

  test('handles malformed YAML gracefully', () => {
    const raw = `---
title: unclosed string
invalid: [broken
---

Body`
    const result = parseFrontmatter(raw)
    expect(result.body).toBe('Body')
    expect(typeof result.frontmatter.title).toBe('string')
  })

  test('handles empty file', () => {
    const result = parseFrontmatter('')
    expect(result.frontmatter.title).toBe('')
    expect(result.body).toBe('')
  })

  test('handles file with only frontmatter', () => {
    const raw = `---
title: Just Frontmatter
---

`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter.title).toBe('Just Frontmatter')
    expect(result.body).toBe('')
  })

  test('strips leading whitespace before frontmatter', () => {
    const raw = `


---
title: Leading Whitespace
---

Body`

    const result = parseFrontmatter(raw)
    expect(result.frontmatter.title).toBe('Leading Whitespace')
    expect(result.body).toBe('Body')
  })

  test('handles unknown compatibility values gracefully', () => {
    const raw = `---
title: Custom Compatibility
compatibility: [opencode, copilot, unknown-agent]
---
Body`
    const result = parseFrontmatter(raw)
    expect(result.frontmatter.title).toBe('Custom Compatibility')
    expect(result.frontmatter.compatibility).toEqual(['opencode', 'copilot', 'unknown-agent'])
  })
})

describe('serializeFrontmatter', () => {
  test('serializes non-empty fields', () => {
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

  test('omits empty fields', () => {
    const fm = frontmatterSchema.parse({})
    const result = serializeFrontmatter(fm)
    expect(result).not.toContain('title:')
    expect(result).not.toContain('description:')
  })
})

describe('validateFrontmatter', () => {
  test('accepts complete frontmatter', () => {
    const result = validateFrontmatter({
      title: 'Test Rule',
      description: 'A test rule',
      tags: ['test'],
      version: '1.0.0',
    })
    expect(result.valid).toBe(true)
  })

  test('accepts minimal valid frontmatter', () => {
    const result = validateFrontmatter({
      title: 'Minimal',
      description: 'Works',
      tags: ['tag1'],
    })
    expect(result.valid).toBe(true)
  })

  test('rejects missing title', () => {
    const result = validateFrontmatter({
      description: 'Desc',
      tags: ['t'],
    })
    expect(result.valid).toBe(false)
    expect(result.errors!.some(e => e.includes('title'))).toBe(true)
  })

  test('rejects empty title', () => {
    const result = validateFrontmatter({
      title: '',
      description: 'Desc',
      tags: ['t'],
    })
    expect(result.valid).toBe(false)
    expect(result.errors!.some(e => e.includes('title'))).toBe(true)
  })

  test('rejects missing description', () => {
    const result = validateFrontmatter({
      title: 'T',
      tags: ['t'],
    })
    expect(result.valid).toBe(false)
    expect(result.errors!.some(e => e.includes('description'))).toBe(true)
  })

  test('rejects missing tags', () => {
    const result = validateFrontmatter({
      title: 'T',
      description: 'D',
    })
    expect(result.valid).toBe(false)
    expect(result.errors!.some(e => e.includes('tags'))).toBe(true)
  })

  test('rejects empty tags array', () => {
    const result = validateFrontmatter({
      title: 'T',
      description: 'D',
      tags: [],
    })
    expect(result.valid).toBe(false)
    expect(result.errors!.some(e => e.includes('tags'))).toBe(true)
  })

  test('rejects invalid version', () => {
    const result = validateFrontmatter({
      title: 'T',
      description: 'D',
      tags: ['t'],
      version: 'abc',
    })
    expect(result.valid).toBe(false)
    expect(result.errors!.some(e => e.includes('version'))).toBe(true)
  })
})
