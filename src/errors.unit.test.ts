import { describe, expect, test } from 'vitest'
import { AikError, ContentError, NotFoundError, ValidationError } from './errors.js'

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

describe('ValidationError', () => {
  test('should store errors array', () => {
    const errors = ['field1 is required', 'field2 is invalid']
    const err = new ValidationError(errors)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.errors).toEqual(errors)
    expect(err.message).toBe('Validation failed')
    expect(err.cause).toEqual(errors)
  })
})

describe('NotFoundError', () => {
  test('should format message with resource and id', () => {
    const err = new NotFoundError('ContentItem', 'rules/foo')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('ContentItem not found: rules/foo')
  })
})
