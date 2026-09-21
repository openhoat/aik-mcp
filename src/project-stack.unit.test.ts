import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { detectMcpServers, detectStacks, evaluateGate } from './project-stack.js'

const dirs: string[] = []

const makeDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'aik-stack-'))
  dirs.push(dir)
  return dir
}

const write = (dir: string, file: string, content = ''): void => {
  const full = join(dir, file)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content, 'utf-8')
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('detectStacks', () => {
  test('returns empty for an unknown project', () => {
    expect(detectStacks(makeDir())).toEqual([])
  })

  test('detects python from pyproject.toml', () => {
    const dir = makeDir()
    write(dir, 'pyproject.toml')
    expect(detectStacks(dir)).toEqual(['python'])
  })

  test('detects angular and nodejs together', () => {
    const dir = makeDir()
    write(dir, 'angular.json')
    write(dir, 'package.json')
    expect(detectStacks(dir)).toEqual(['angular', 'nodejs'])
  })

  test('detects multiple ecosystems', () => {
    const dir = makeDir()
    write(dir, 'package.json')
    write(dir, 'Cargo.toml')
    expect(detectStacks(dir).sort()).toEqual(['nodejs', 'rust'])
  })
})

describe('detectMcpServers', () => {
  test('returns null when no MCP config exists', () => {
    expect(detectMcpServers(makeDir())).toBeNull()
  })

  test('reads mcpServers from .mcp.json', () => {
    const dir = makeDir()
    write(dir, '.mcp.json', JSON.stringify({ mcpServers: { 'local-rag': {}, intellij: {} } }))
    expect(detectMcpServers(dir)?.sort()).toEqual(['intellij', 'local-rag'])
  })

  test('returns an empty array when config exists but declares no server', () => {
    const dir = makeDir()
    write(dir, '.mcp.json', JSON.stringify({ mcpServers: {} }))
    expect(detectMcpServers(dir)).toEqual([])
  })

  test('reads the mcp section from opencode.jsonc with comments', () => {
    const dir = makeDir()
    write(
      dir,
      '.opencode/opencode.jsonc',
      `{
        // local MCP servers
        "mcp": { "local-rag": { "type": "local" } }
      }`
    )
    expect(detectMcpServers(dir)).toEqual(['local-rag'])
  })
})

describe('evaluateGate', () => {
  test('allows content without gating metadata', () => {
    const result = evaluateGate({ appliesTo: [], requires: [] }, makeDir())
    expect(result.blocked).toBe(false)
    expect(result.errors).toEqual([])
  })

  test('blocks when applies-to does not match the detected stack', () => {
    const dir = makeDir()
    write(dir, 'pyproject.toml')
    const result = evaluateGate({ appliesTo: ['angular'], requires: [] }, dir)
    expect(result.blocked).toBe(true)
    expect(result.errors[0]).toContain('angular')
  })

  test('allows when applies-to matches the detected stack', () => {
    const dir = makeDir()
    write(dir, 'angular.json')
    write(dir, 'package.json')
    const result = evaluateGate({ appliesTo: ['angular'], requires: [] }, dir)
    expect(result.blocked).toBe(false)
  })

  test('warns instead of blocking when the stack cannot be detected', () => {
    const result = evaluateGate({ appliesTo: ['angular'], requires: [] }, makeDir())
    expect(result.blocked).toBe(false)
    expect(result.warnings).toHaveLength(1)
  })

  test('blocks when a required MCP server is missing', () => {
    const dir = makeDir()
    write(dir, '.mcp.json', JSON.stringify({ mcpServers: { intellij: {} } }))
    const result = evaluateGate({ appliesTo: [], requires: ['mcp-local-rag'] }, dir)
    expect(result.blocked).toBe(true)
    expect(result.errors[0]).toContain('mcp-local-rag')
  })

  test('matches required MCP server ignoring the mcp- prefix', () => {
    const dir = makeDir()
    write(dir, '.mcp.json', JSON.stringify({ mcpServers: { 'local-rag': {} } }))
    const result = evaluateGate({ appliesTo: [], requires: ['mcp-local-rag'] }, dir)
    expect(result.blocked).toBe(false)
  })

  test('warns when MCP configuration cannot be verified', () => {
    const result = evaluateGate({ appliesTo: [], requires: ['mcp-local-rag'] }, makeDir())
    expect(result.blocked).toBe(false)
    expect(result.warnings).toHaveLength(1)
  })

  test('force bypasses blocking', () => {
    const dir = makeDir()
    write(dir, 'pyproject.toml')
    const result = evaluateGate({ appliesTo: ['angular'], requires: [] }, dir, { force: true })
    expect(result.blocked).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
