import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { packageVersion } from './version.js'

// The server announces this version to every client. It used to be the literal
// "1.0.0", which made a 0.10 release report the identity of a 1.0 one: the test
// below is what keeps the two in step.

const manifestVersion = (): string => {
  const parsed: unknown = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
  )
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    throw new Error('package.json has no version')
  }
  if (typeof parsed.version !== 'string') throw new Error('package.json version is not a string')
  return parsed.version
}

describe('packageVersion', () => {
  test('reports the version of the package it ships in', () => {
    expect(packageVersion()).toBe(manifestVersion())
  })

  test('is a semver string, and not a placeholder', () => {
    expect(packageVersion()).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
