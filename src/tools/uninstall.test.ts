import { describe, expect, test } from '@jest/globals'
import { removeSections } from './uninstall.js'

describe('removeSections', () => {
  // isTarget receives the full text from the current heading to end of content.
  const isTarget = (text: string) => {
    const firstLine = text.split('\n')[0]
    return firstLine.startsWith('## ') && firstLine.includes('test-section')
  }

  test('should return empty result for empty content', () => {
    const { result, count } = removeSections('', isTarget)
    expect(result).toBe('')
    expect(count).toBe(0)
  })

  test('should remove matching section', () => {
    const content = `# Header\n\n## test-section\nsome content\n\n## other\nkeep this`
    const { result, count } = removeSections(content, isTarget)
    expect(count).toBe(1)
    expect(result).toContain('# Header')
    expect(result).toContain('## other')
    expect(result).not.toContain('test-section')
  })

  test('should remove multiple matching sections', () => {
    const content =
      '# Header\n\n## test-section\ncontent\n\n## middle\nkeep\n\n## test-section\nmore content'
    const { result, count } = removeSections(content, isTarget)
    expect(count).toBe(2)
    expect(result).not.toContain('test-section')
    expect(result).toContain('## middle')
  })

  test('should handle sections with no following heading', () => {
    const content = `# Header\n\n## test-section\ncontent until EOF`
    const { result, count } = removeSections(content, isTarget)
    expect(count).toBe(1)
    expect(result).toBe('# Header\n')
  })

  test('should not modify content when no target found', () => {
    const content = '# Header\n\n## unrelated\nstuff'
    const { result, count } = removeSections(content, isTarget)
    expect(count).toBe(0)
    expect(result).toBe(content)
  })

  test('should handle <!-- from --> markers as targets', () => {
    const content = '# Config\n\n<!-- from rules/foo.md -->\nsome content\n\n## Other\nkeep'
    const isMarker = (text: string) => text.startsWith('<!-- from ')
    const { result, count } = removeSections(content, isMarker)
    expect(count).toBe(1)
    expect(result).not.toContain('foo.md')
    expect(result).toContain('## Other')
  })

  test('should handle multiple markers', () => {
    const content =
      '# Config\n\n<!-- from rules/foo.md -->\ncontent1\n\n<!-- from rules/bar.md -->\ncontent2'
    const isMarker = (text: string) => text.startsWith('<!-- from ')
    const { result, count } = removeSections(content, isMarker)
    expect(count).toBe(2)
    expect(result).toBe('# Config\n')
  })
})
