import { describe, expect, test } from 'vitest'
import { extractBearerToken, isAuthorized, isUsableApiKey } from './auth.js'

describe('extractBearerToken', () => {
  test('should return the token of a Bearer header', () => {
    expect(extractBearerToken('Bearer s3cret')).toBe('s3cret')
  })

  test('should trim surrounding spaces', () => {
    expect(extractBearerToken('Bearer   s3cret  ')).toBe('s3cret')
  })

  test('should return undefined without header', () => {
    expect(extractBearerToken(undefined)).toBeUndefined()
    expect(extractBearerToken('')).toBeUndefined()
  })

  test('should reject another scheme', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeUndefined()
    expect(extractBearerToken('bearer s3cret')).toBeUndefined()
  })

  test('should reject an empty token', () => {
    expect(extractBearerToken('Bearer ')).toBeUndefined()
    expect(extractBearerToken('Bearer    ')).toBeUndefined()
  })
})

describe('isUsableApiKey', () => {
  test('should reject an unset key', () => {
    expect(isUsableApiKey('')).toBe(false)
    expect(isUsableApiKey('   ')).toBe(false)
  })

  test('should reject the documented placeholder', () => {
    expect(isUsableApiKey('change-me')).toBe(false)
    expect(isUsableApiKey(' change-me ')).toBe(false)
  })

  test('should accept a real key', () => {
    expect(isUsableApiKey('4f0c1e2d9a7b')).toBe(true)
  })
})

describe('isAuthorized', () => {
  test('should accept the expected token', () => {
    expect(isAuthorized('Bearer s3cret', 's3cret')).toBe(true)
  })

  test('should tolerate surrounding spaces around the configured key', () => {
    expect(isAuthorized('Bearer s3cret', ' s3cret ')).toBe(true)
  })

  test('should reject a wrong token', () => {
    expect(isAuthorized('Bearer wrong', 's3cret')).toBe(false)
    expect(isAuthorized('Bearer s3cret-longer', 's3cret')).toBe(false)
  })

  test('should reject a missing or foreign header', () => {
    expect(isAuthorized(undefined, 's3cret')).toBe(false)
    expect(isAuthorized('Basic s3cret', 's3cret')).toBe(false)
  })

  test('should reject everything when the server key is unusable', () => {
    expect(isAuthorized('Bearer ', '')).toBe(false)
    expect(isAuthorized('Bearer change-me', 'change-me')).toBe(false)
  })
})
