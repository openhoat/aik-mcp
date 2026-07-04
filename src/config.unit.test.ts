import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { loadConfig } from './config.js'

describe('config', () => {
  const envBackup: Record<string, string | undefined> = {}

  beforeEach(() => {
    envBackup.AIK_CONTENT_DIR = process.env.AIK_CONTENT_DIR
    delete process.env.AIK_CONTENT_DIR
  })

  afterEach(() => {
    if (envBackup.AIK_CONTENT_DIR) {
      process.env.AIK_CONTENT_DIR = envBackup.AIK_CONTENT_DIR
    }
  })

  test('should use defaults when no args and no env', () => {
    const config = loadConfig([])
    expect(config.http).toBe(false)
    expect(config.port).toBe(3456)
    expect(config.watch).toBe(true)
    expect(config.contentDir).toBe(process.cwd())
  })

  test('should detect --http flag', () => {
    expect(loadConfig(['--http']).http).toBe(true)
  })

  test('should detect custom --port', () => {
    expect(loadConfig(['--port', '8080']).port).toBe(8080)
  })

  test('should default port when --port has no value', () => {
    expect(loadConfig(['--port']).port).toBe(3456)
  })

  test('should detect --no-watch flag', () => {
    expect(loadConfig(['--no-watch']).watch).toBe(false)
  })

  test('should read AIK_CONTENT_DIR from env', () => {
    process.env.AIK_CONTENT_DIR = '/custom/path'
    expect(loadConfig([]).contentDir).toBe('/custom/path')
  })

  test('should handle combined flags', () => {
    const config = loadConfig(['--http', '--port', '9090', '--no-watch'])
    expect(config.http).toBe(true)
    expect(config.port).toBe(9090)
    expect(config.watch).toBe(false)
  })
})
