import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

// Minimal interface matching what logger.ts passes to pino()
interface PinoOptions {
  name: string
  level: string
  transport?: { target: string; options?: Record<string, unknown> }
}

const mockPino = jest.fn<(opts: PinoOptions, dest?: object) => Record<string, jest.Mock>>(() => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}))
const mockDestination = jest.fn<(fd: number) => object>(() => ({}))

jest.mock('pino', () => {
  const pino = Object.assign(mockPino, { destination: mockDestination })
  return pino
})

describe('logger', () => {
  beforeEach(() => {
    jest.resetModules()
    mockPino.mockClear()
    mockDestination.mockClear()
    delete process.env.LOG_LEVEL
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    delete process.env.NODE_ENV
  })

  test('should create logger with name aik', async () => {
    const { logger } = await import('./logger.js')
    expect(logger).toBeDefined()
    expect(mockPino).toHaveBeenCalledTimes(1)
    expect(mockPino.mock.calls[0][0].name).toBe('aik')
  })

  test('should use pino-pretty transport in development', async () => {
    process.env.NODE_ENV = 'development'
    await import('./logger.js')
    const opts = mockPino.mock.calls[0][0]
    expect(opts.transport).toBeDefined()
    if (opts.transport) {
      expect(opts.transport.target).toBe('pino-pretty')
    }
  })

  test('should not use transport in production', async () => {
    process.env.NODE_ENV = 'production'
    await import('./logger.js')
    const opts = mockPino.mock.calls[0][0]
    expect(opts.transport).toBeUndefined()
  })

  test('should use LOG_LEVEL from env', async () => {
    process.env.LOG_LEVEL = 'error'
    await import('./logger.js')
    expect(mockPino.mock.calls[0][0].level).toBe('error')
  })

  test('should default LOG_LEVEL based on NODE_ENV', async () => {
    process.env.NODE_ENV = 'production'
    await import('./logger.js')
    expect(mockPino.mock.calls[0][0].level).toBe('info')
  })

  test('should call pino.destination with fd 2', async () => {
    await import('./logger.js')
    expect(mockDestination).toHaveBeenCalledWith(2)
  })
})
