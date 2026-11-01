import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import {
  type EngineContext,
  type EngineItem,
  findSection,
  install,
  list,
  removeSection,
  uninstall,
} from './engine.js'

// Sections of a shared file are delimited by a heading that opens on a marker.
// The body of a section is content, and content carries its own `##` headings:
// these tests pin the boundary rule, because bounding on any heading silently
// orphaned the rest of a section in the shared file.

const roots: string[] = []

const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'aik-section-'))
  roots.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
})

const item = (name: string, body: string): EngineItem => ({
  path: `rules/${name}`,
  category: 'rules',
  name,
  title: `${name} title`,
  rawContent: `---\ntitle: ${name} title\ntags: [test]\nversion: "1.0.0"\n---\n${body}`,
})

const context = (baseDir: string): EngineContext => ({
  scope: 'project',
  baseDir,
  configPath: null,
})

// codex keeps every rule as a section of AGENTS.md, the shape under test.
const agentsFile = (baseDir: string): string => join(baseDir, 'AGENTS.md')

const read = (baseDir: string): string => {
  const file = agentsFile(baseDir)
  return existsSync(file) ? readFileSync(file, 'utf-8') : ''
}

const NESTED_BODY = `
## Objective

Explain the rule.

## Rules

### 1. One rule

Do the thing.

## Enforcement

Checked at review.
`

describe('section bounds', () => {
  test('findSection locates the heading that opens on the marker', () => {
    const content = [
      '## Other',
      '',
      '<source>rules/other</source>',
      '',
      '## Rules',
      '',
      'body',
      '',
      '## Target',
      '',
      '<source>rules/target</source>',
      '',
      '## Objective',
      '',
      'text',
    ].join('\n')

    const range = findSection(content, '<source>rules/target</source>')

    expect(range).not.toBeNull()
    const lines = content.split('\n')
    expect(lines[(range as { start: number }).start]).toBe('## Target')
    // The inner `## Objective` belongs to the section, not to the next one.
    expect(range).toEqual({ start: 8, end: lines.length })
  })

  test('a heading without a marker does not open a section', () => {
    expect(findSection('## Solo\n\ntext', '<source>rules/solo</source>')).toBeNull()
  })

  test('removeSection keeps the sections that follow', () => {
    const content = [
      '## First',
      '',
      '<source>rules/first</source>',
      '',
      '## Objective',
      '',
      'first text',
      '',
      '## Second',
      '',
      '<source>rules/second</source>',
      '',
      '## Objective',
      '',
      'second text',
    ].join('\n')

    const { result, count } = removeSection(content, '<source>rules/first</source>')

    expect(count).toBe(1)
    expect(result).not.toContain('first text')
    expect(result).toContain('## Second')
    expect(result).toContain('second text')
  })

  test('removing an absent section changes nothing', () => {
    const content = '## Solo\n\n<source>rules/solo</source>\n'
    expect(removeSection(content, '<source>rules/other</source>')).toEqual({
      result: content,
      count: 0,
    })
  })
})

describe('install and uninstall a section that carries its own headings', () => {
  test('round-trips a file that already had content', () => {
    const baseDir = tempDir()
    const before = '# Project notes\n\nSomething the user wrote.\n'
    writeFileSync(agentsFile(baseDir), before, 'utf-8')

    install('codex', item('nested', NESTED_BODY), context(baseDir))
    const installed = read(baseDir)
    expect(installed).toContain('<source>rules/nested</source>')
    expect(installed).toContain('Do the thing.')

    expect(uninstall('codex', item('nested', NESTED_BODY), context(baseDir))).toBe(true)
    expect(read(baseDir)).toBe(before)
  })

  test('round-trips an empty file, and leaves no residue', () => {
    const baseDir = tempDir()

    install('codex', item('nested', NESTED_BODY), context(baseDir))
    uninstall('codex', item('nested', NESTED_BODY), context(baseDir))

    const after = read(baseDir)
    expect(after.trim()).toBe('')
    expect(after).not.toContain('Do the thing.')
  })

  test('lists only headings that open on a marker', () => {
    const baseDir = tempDir()
    install('codex', item('nested', NESTED_BODY), context(baseDir))
    // An orphaned body (no marker) is what a broken removal used to leave behind.
    writeFileSync(agentsFile(baseDir), `${read(baseDir)}\n## Orphan\n\n## Objective\n\nleft over\n`)

    const listed = list('codex', context(baseDir)).map(entry => entry.path)

    expect(listed).toEqual(['rules/nested'])
  })
})
