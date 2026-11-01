import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'
import type { InstallPlan, PlanAction } from '../../tools/agents/plan.js'

// End-to-end proof of the shipped applier: the `aik-apply` command is what a shell
// client runs on a plan served by the remote server. It must apply the payload
// byte-for-byte, honour --dry-run, and fail closed on a corrupt plan.

const here = dirname(fileURLToPath(import.meta.url))
const cliPath = resolve(here, '../../../bin/aik-apply.mjs')

const roots: string[] = []

const tempDir = (label: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `aik-apply-cli-${label}-`))
  roots.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
})

const digest = (content: Buffer | string): string =>
  createHash('sha256').update(content).digest('hex')

const plan = (actions: PlanAction[]): InstallPlan => ({
  planVersion: 1,
  operation: 'install',
  item: { path: 'rules/demo', name: 'demo', category: 'rules', title: 'Demo', version: '1.0.0' },
  agent: 'claude-code',
  scope: 'project',
  base: { kind: 'project', hint: 'the project root' },
  actions,
  warnings: [],
  summary: `install rules/demo for claude-code (project): ${actions.length} action(s) to apply`,
})

const run = (args: string[], input?: string) =>
  spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf-8',
    input,
  })

describe('aik-apply', () => {
  test('applies a plan file: file write plus config entry', () => {
    const base = tempDir('file')
    const content = '# Demo\n\nbody\n'
    const payload = plan([
      { op: 'write_file', path: 'rules/demo.md', content, sha256: digest(content) },
      {
        op: 'config_entry_add',
        key: 'instructions',
        candidates: ['.claude/settings.json'],
        path: 'rules/demo.md',
      },
    ])
    const planFile = join(base, 'plan.json')
    writeFileSync(planFile, JSON.stringify(payload), 'utf-8')

    const result = run([planFile, '--base', base])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('install rules/demo for claude-code (project)')
    expect(readFileSync(join(base, 'rules/demo.md'), 'utf-8')).toBe(content)
    const config = JSON.parse(readFileSync(join(base, '.claude/settings.json'), 'utf-8'))
    expect(config.instructions).toEqual(['rules/demo.md'])
  })

  test('applies a plan from stdin, binary asset included', () => {
    const base = tempDir('stdin')
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252])
    const skillMd = '---\nname: demo\n---\nbody\n'
    const payload = plan([
      {
        op: 'install_skill',
        dir: '.claude/skills/demo',
        skillMd: {
          relPath: 'SKILL.md',
          content: skillMd,
          encoding: 'utf8',
          sha256: digest(skillMd),
        },
        assets: [
          {
            relPath: 'assets/blob.bin',
            content: bytes.toString('base64'),
            encoding: 'base64',
            sha256: digest(bytes),
          },
        ],
      },
    ])

    const result = run(['--base', base], JSON.stringify(payload))

    expect(result.status).toBe(0)
    expect(readFileSync(join(base, '.claude/skills/demo/SKILL.md'), 'utf-8')).toBe(skillMd)
    expect([...readFileSync(join(base, '.claude/skills/demo/assets/blob.bin'))]).toEqual([...bytes])
    expect(result.stdout).toContain('install_skill')
  })

  test('--dry-run resolves the base and writes nothing', () => {
    const base = tempDir('dry')
    const content = 'x\n'
    const payload = plan([{ op: 'write_file', path: 'a/b.md', content, sha256: digest(content) }])

    const result = run(['--dry-run', '--base', base], JSON.stringify(payload))

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`into ${base}`)
    expect(result.stdout).toContain('dry run, nothing written')
    expect(existsSync(join(base, 'a/b.md'))).toBe(false)
  })

  test('refuses a corrupt payload: sha256 mismatch, nothing written', () => {
    const base = tempDir('corrupt')
    const payload = plan([
      { op: 'write_file', path: 'rules/demo.md', content: 'tampered', sha256: 'deadbeef' },
    ])

    const result = run(['--base', base], JSON.stringify(payload))

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('sha256 mismatch')
    expect(existsSync(join(base, 'rules/demo.md'))).toBe(false)
  })

  test('refuses something that is not a plan, and a missing plan file', () => {
    const notAPlan = run([], JSON.stringify({ hello: 'world' }))
    expect(notAPlan.status).toBe(1)
    expect(notAPlan.stderr).toContain('not an aik plan')

    const missing = run([join(tempDir('missing'), 'nope.json')])
    expect(missing.status).toBe(1)
    expect(missing.stderr).toContain('aik-apply:')
  })

  test('prints its usage on --help', () => {
    const result = run(['--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Usage: aik-apply')
    expect(result.stdout).toContain('--dry-run')
  })

  test('creates the global base from the hint when it does not exist yet', () => {
    const home = tempDir('global')
    const content = 'x\n'
    const payload = plan([
      { op: 'write_file', path: 'rules/demo.md', content, sha256: digest(content) },
    ])
    payload.base = { kind: 'agent-global', hint: `${home}/.config/opencode` }

    const result = run([], JSON.stringify(payload))

    expect(result.status).toBe(0)
    expect(readFileSync(join(home, '.config/opencode/rules/demo.md'), 'utf-8')).toBe(content)
  })
})
