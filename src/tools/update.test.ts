import { describe, expect, test } from '@jest/globals'
import { isNewer, parseSemver } from './update.js'

describe('parseSemver', () => {
  test('should parse simple version', () => {
    expect(parseSemver('1.2.3')).toEqual([1, 2, 3])
  })

  test('should handle single digit', () => {
    expect(parseSemver('1')).toEqual([1])
  })

  test('should handle empty string', () => {
    expect(parseSemver('')).toEqual([0])
  })
})

describe('isNewer', () => {
  test('should return true when store version is newer', () => {
    expect(isNewer('2.0.0', '1.0.0')).toBe(true)
  })

  test('should return false when store version is older', () => {
    expect(isNewer('1.0.0', '2.0.0')).toBe(false)
  })

  test('should return false when versions are equal', () => {
    expect(isNewer('1.2.3', '1.2.3')).toBe(false)
  })

  test('should compare major version first', () => {
    expect(isNewer('2.0.0', '1.9.9')).toBe(true)
    expect(isNewer('1.9.9', '2.0.0')).toBe(false)
  })

  test('should handle different length versions', () => {
    expect(isNewer('1.2.3', '1.2')).toBe(true)
    expect(isNewer('1.2', '1.2.3')).toBe(false)
  })

  test('should handle major upgrade', () => {
    expect(isNewer('2.0.0', '1.0.0')).toBe(true)
  })

  test('should handle minor upgrade', () => {
    expect(isNewer('1.2.0', '1.1.9')).toBe(true)
  })

  test('should handle patch upgrade', () => {
    expect(isNewer('1.1.2', '1.1.1')).toBe(true)
  })
})
