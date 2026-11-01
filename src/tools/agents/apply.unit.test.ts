import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { applyPlan, expandBaseHint, resolveBaseDir } from './apply.js'
import type { InstallPlan, PlanAction } from './plan.js'

// The applier ships with the package (aik-apply), so it is now a first-class
// consumer of the plan payload: these tests pin what applying a plan does, from
// hint resolution down to the legacy section fallback.

const roots: string[] = []

const tempDir = (label: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `aik-apply-${label}-`))
  roots.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

const digest = (content: Buffer | string): string =>
  createHash('sha256').update(content).digest('hex')

const basePlan = (actions: PlanAction[], overrides: Partial<InstallPlan> = {}): InstallPlan => ({
  planVersion: 1,
  operation: 'install',
  item: { path: 'rules/demo', name: 'demo', category: 'rules', title: 'Demo', version: '1.0.0' },
  agent: 'codex',
  scope: 'project',
  base: { kind: 'project', hint: 'the project root' },
  actions,
  warnings: [],
  summary: 'demo',
  ...overrides,
})

const writeAction = (path: string, content: string): PlanAction => ({
  op: 'write_file',
  path,
  content,
  sha256: digest(content),
})

describe('base hint resolution', () => {
  test('expands a tilde hint', () => {
    expect(expandBaseHint('~/.claude')).toBe(join(homedir(), '.claude'))
  })

  test('prefers the first candidate whose variable is set', () => {
    vi.stubEnv('AIK_TEST_HOME', '/opt/aik-test-home')
    expect(expandBaseHint('$AIK_TEST_HOME or ~/.codex')).toBe('/opt/aik-test-home')
  })

  test('falls back when the variable is unset, never resolving to an empty path', () => {
    vi.stubEnv('AIK_TEST_UNSET', '')
    expect(expandBaseHint('$AIK_TEST_UNSET or ~/.codex')).toBe(join(homedir(), '.codex'))
  })

  test('drops a parenthesized fallback before splitting alternatives', () => {
    expect(expandBaseHint('~/Documents/Cline/Rules (fallback: ~/Cline/Rules)')).toBe(
      join(homedir(), 'Documents/Cline/Rules')
    )
  })

  test('refuses a hint it cannot resolve', () => {
    expect(() => expandBaseHint('$AIK_TEST_NEVER_SET_DIR')).toThrow(/cannot resolve the base hint/)
  })

  test('the project scope defaults to the working directory, an override wins', () => {
    expect(resolveBaseDir(basePlan([]))).toBe(process.cwd())
    expect(resolveBaseDir(basePlan([]), '/tmp')).toBe('/tmp')
    expect(resolveBaseDir(basePlan([]), '~/.claude')).toBe(join(homedir(), '.claude'))
  })
})

describe('write_file', () => {
  test('creates parent directories and writes the exact bytes', () => {
    const base = tempDir('write')
    const result = applyPlan(basePlan([writeAction('rules/demo.md', 'hello\n')]), { base })

    expect(readFileSync(join(base, 'rules/demo.md'), 'utf-8')).toBe('hello\n')
    expect(result.applied).toBe(1)
    expect(result.base).toBe(base)
  })

  test('fails closed on a sha256 mismatch, leaving no file behind', () => {
    const base = tempDir('corrupt')
    const action: PlanAction = {
      op: 'write_file',
      path: 'rules/demo.md',
      content: 'tampered',
      sha256: 'deadbeef',
    }

    expect(() => applyPlan(basePlan([action]), { base })).toThrow(/sha256 mismatch/)
    expect(existsSync(join(base, 'rules/demo.md'))).toBe(false)
  })

  test('dry run verifies but writes nothing', () => {
    const base = tempDir('dry')
    const result = applyPlan(basePlan([writeAction('a/b.md', 'x')]), { base, dryRun: true })

    expect(result.applied).toBe(1)
    expect(existsSync(join(base, 'a/b.md'))).toBe(false)
  })
})

interface FixtureAsset {
  relPath: string
  content: string
  encoding: 'utf8' | 'base64'
}

const decodeAsset = (asset: FixtureAsset): Buffer | string =>
  asset.encoding === 'base64' ? Buffer.from(asset.content, 'base64') : asset.content

const skillAction = (): PlanAction => {
  const assets: FixtureAsset[] = [
    { relPath: 'assets/note.txt', content: 'plain\n', encoding: 'utf8' },
    {
      relPath: 'assets/blob.bin',
      content: Buffer.from([0, 1, 2, 250, 251]).toString('base64'),
      encoding: 'base64',
    },
  ]
  const skillMd = '---\nname: demo\n---\nbody\n'

  return {
    op: 'install_skill',
    dir: 'skills/demo',
    skillMd: { relPath: 'SKILL.md', content: skillMd, encoding: 'utf8', sha256: digest(skillMd) },
    assets: assets.map(asset => ({ ...asset, sha256: digest(decodeAsset(asset)) })),
  }
}

describe('install_skill', () => {
  test('writes the entry file and every asset, text and binary alike', () => {
    const base = tempDir('skill')
    applyPlan(basePlan([skillAction()]), { base })

    expect(readFileSync(join(base, 'skills/demo/SKILL.md'), 'utf-8')).toContain('body')
    expect(readFileSync(join(base, 'skills/demo/assets/note.txt'), 'utf-8')).toBe('plain\n')
    expect([...readFileSync(join(base, 'skills/demo/assets/blob.bin'))]).toEqual([
      0, 1, 2, 250, 251,
    ])
  })

  test('skips a skill that is already installed', () => {
    const base = tempDir('skill-skip')
    mkdirSync(join(base, 'skills/demo'), { recursive: true })
    writeFileSync(join(base, 'skills/demo/SKILL.md'), 'hand edited\n', 'utf-8')

    const result = applyPlan(basePlan([skillAction()]), { base })

    expect(result.skipped).toBe(1)
    expect(readFileSync(join(base, 'skills/demo/SKILL.md'), 'utf-8')).toBe('hand edited\n')
  })
})

describe('sections in a shared file', () => {
  const NESTED = '## Objective\n\nnested body\n\n## Rules\n\nmore\n'
  const upsertAction = (marker: string): PlanAction => ({
    op: 'section_upsert',
    file: 'AGENTS.md',
    marker,
    heading: '## Demo',
    content: NESTED,
    sha256: digest(NESTED),
  })

  test('appends a section and keeps what the user already had', () => {
    const base = tempDir('section')
    const before = '# Notes\n\nhand written\n'
    writeFileSync(join(base, 'AGENTS.md'), before, 'utf-8')

    applyPlan(basePlan([upsertAction('<source>rules/demo</source>')]), { base })

    const after = readFileSync(join(base, 'AGENTS.md'), 'utf-8')
    expect(after.startsWith(before)).toBe(true)
    expect(after).toContain('<source>rules/demo</source>')
  })

  test('is idempotent: the same plan applied twice adds one section', () => {
    const base = tempDir('section-idem')
    const action = upsertAction('<source>rules/demo</source>')

    applyPlan(basePlan([action]), { base })
    const second = applyPlan(basePlan([action]), { base })

    expect(second.skipped).toBe(1)
    const content = readFileSync(join(base, 'AGENTS.md'), 'utf-8')
    expect(content.match(/<source>rules\/demo<\/source>/g)?.length).toBe(1)
  })

  test('section_remove stops at the next marker, not at an inner heading', () => {
    const base = tempDir('section-remove')
    const file = join(base, 'AGENTS.md')
    writeFileSync(
      file,
      [
        '## First',
        '',
        '<source>rules/first</source>',
        '',
        '## Objective',
        '',
        'first body',
        '',
        '## Second',
        '',
        '<source>rules/second</source>',
        '',
        '## Objective',
        '',
        'second body',
        '',
      ].join('\n'),
      'utf-8'
    )

    applyPlan(
      basePlan([
        { op: 'section_remove', file: 'AGENTS.md', marker: '<source>rules/first</source>' },
      ]),
      { base }
    )

    const after = readFileSync(file, 'utf-8')
    expect(after).not.toContain('first body')
    expect(after).not.toContain('<source>rules/first</source>')
    expect(after).toContain('second body')
    expect(after).toContain('<source>rules/second</source>')
  })

  test('an absent marker is a no-op, a legacy marker still converges', () => {
    const base = tempDir('section-legacy')
    const file = join(base, 'AGENTS.md')
    writeFileSync(file, '## Kept\n\n<source>rules/kept</source>\n\nbody\n', 'utf-8')

    const absent = applyPlan(
      basePlan([
        { op: 'section_remove', file: 'AGENTS.md', marker: '<source>rules/absent</source>' },
      ]),
      { base }
    )
    expect(absent.skipped).toBe(1)
    expect(readFileSync(file, 'utf-8')).toContain('body')

    // Marker not on the opening line (hand-edited file): remove the block anyway
    // instead of duplicating it on the next install.
    writeFileSync(file, '## Legacy\n\nintro\n<source>rules/legacy</source>\n\ntail\n', 'utf-8')
    applyPlan(
      basePlan([
        { op: 'section_remove', file: 'AGENTS.md', marker: '<source>rules/legacy</source>' },
      ]),
      { base }
    )
    const after = readFileSync(file, 'utf-8')
    expect(after).not.toContain('<source>rules/legacy</source>')
    expect(after).not.toContain('tail')
  })
})

const configPlan = (scope: 'project' | 'global'): InstallPlan =>
  basePlan(
    [
      {
        op: 'config_entry_add',
        key: 'instructions',
        candidates: ['opencode.jsonc', 'opencode.json'],
        path: 'rules/demo.md',
      },
    ],
    {
      scope,
      base:
        scope === 'global'
          ? { kind: 'agent-global', hint: '~/.config/opencode' }
          : { kind: 'project', hint: 'root' },
    }
  )

describe('config entries', () => {
  test('stores the entry relative to the project root in the project scope', () => {
    const base = tempDir('config-project')
    applyPlan(configPlan('project'), { base })

    const config = JSON.parse(readFileSync(join(base, 'opencode.jsonc'), 'utf-8'))
    expect(config.instructions).toEqual(['rules/demo.md'])
  })

  test('stores a tilde-absolute path in the global scope', () => {
    const base = join(homedir(), `.aik-apply-test-${process.pid}`)
    roots.push(base)
    applyPlan(configPlan('global'), { base })

    const config = JSON.parse(readFileSync(join(base, 'opencode.jsonc'), 'utf-8'))
    const expected = `~${join(base, 'rules/demo.md').slice(homedir().length)}`
    expect(config.instructions).toEqual([expected])
  })

  test('does not duplicate an entry, and removes it again', () => {
    const base = tempDir('config-idem')
    const plan = configPlan('project')

    applyPlan(plan, { base })
    const second = applyPlan(plan, { base })
    expect(second.skipped).toBe(1)

    applyPlan(
      basePlan(
        [
          {
            op: 'config_entry_remove',
            key: 'instructions',
            candidates: ['opencode.jsonc'],
            path: 'rules/demo.md',
          },
        ],
        { scope: 'project' }
      ),
      { base }
    )
    const config = JSON.parse(readFileSync(join(base, 'opencode.jsonc'), 'utf-8'))
    expect(config.instructions).toEqual([])
  })

  test('prefers the first candidate that exists', () => {
    const base = tempDir('config-candidates')
    writeFileSync(join(base, 'opencode.json'), '{}', 'utf-8')

    applyPlan(
      basePlan(
        [
          {
            op: 'config_entry_add',
            key: 'instructions',
            candidates: ['opencode.jsonc', 'opencode.json'],
            path: 'r.md',
          },
        ],
        { scope: 'project' }
      ),
      { base }
    )

    expect(existsSync(join(base, 'opencode.jsonc'))).toBe(false)
    expect(JSON.parse(readFileSync(join(base, 'opencode.json'), 'utf-8')).instructions).toEqual([
      'r.md',
    ])
  })
})

describe('deletions and failures', () => {
  test('delete_file and delete_dir are idempotent', () => {
    const base = tempDir('delete')
    writeFileSync(join(base, 'a.md'), 'x', 'utf-8')
    mkdirSync(join(base, 'skills/demo'), { recursive: true })

    const plan = basePlan([
      { op: 'delete_file', path: 'a.md' },
      { op: 'delete_dir', path: 'skills/demo' },
      { op: 'delete_file', path: 'a.md' },
    ])
    const result = applyPlan(plan, { base })

    expect(existsSync(join(base, 'a.md'))).toBe(false)
    expect(existsSync(join(base, 'skills/demo'))).toBe(false)
    expect(result.applied).toBe(2)
    expect(result.skipped).toBe(1)
  })

  test('an unknown operation is refused, not silently ignored', () => {
    const plan = basePlan([{ op: 'chmod', path: 'x' } as unknown as PlanAction])
    expect(() => applyPlan(plan, { base: tempDir('unknown') })).toThrow(
      /unknown plan operation "chmod"/
    )
  })

  test('dry run leaves the tree untouched', () => {
    const base = tempDir('dry-tree')
    writeFileSync(join(base, 'AGENTS.md'), '# Notes\n', 'utf-8')
    const before = statSync(join(base, 'AGENTS.md')).mtimeMs

    applyPlan(
      basePlan([
        writeAction('rules/x.md', 'x'),
        {
          op: 'section_upsert',
          file: 'AGENTS.md',
          marker: '<source>rules/x</source>',
          heading: '## X',
          content: 'body',
          sha256: digest('body'),
        },
        { op: 'delete_file', path: 'AGENTS.md' },
      ]),
      { base, dryRun: true }
    )

    expect(existsSync(join(base, 'rules/x.md'))).toBe(false)
    expect(readFileSync(join(base, 'AGENTS.md'), 'utf-8')).toBe('# Notes\n')
    expect(statSync(join(base, 'AGENTS.md')).mtimeMs).toBe(before)
  })
})
