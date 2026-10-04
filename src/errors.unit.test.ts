import { describe, expect, test } from 'vitest'
import { AikError, ContentError } from './errors.js'

describe('AikError', () => {
  test('should create error with code and message', () => {
    const err = new AikError('TEST_CODE', 'test message')
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test message')
    expect(err.name).toBe('AikError')
  })

  test('should support cause option', () => {
    const cause = new Error('root cause')
    const err = new AikError('TEST_CODE', 'test', { cause })
    expect(err.cause).toBe(cause)
  })
})

describe('ContentError', () => {
  test('should extend AikError', () => {
    const err = new ContentError('CONTENT_EXISTS', 'already exists')
    expect(err).toBeInstanceOf(AikError)
    expect(err.code).toBe('CONTENT_EXISTS')
    expect(err.name).toBe('ContentError')
  })
})
