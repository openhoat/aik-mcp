export class AikError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.code = code
    this.name = this.constructor.name
  }
}

export class ContentError extends AikError {}
