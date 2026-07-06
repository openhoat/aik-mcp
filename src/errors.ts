export class AikError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.code = code
    this.name = this.constructor.name
  }
}

export class ContentError extends AikError {}

export class ValidationError extends AikError {
  readonly errors: string[]

  constructor(errors: string[]) {
    super('VALIDATION_ERROR', 'Validation failed', { cause: errors })
    this.errors = errors
  }
}

export class NotFoundError extends AikError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`)
  }
}
