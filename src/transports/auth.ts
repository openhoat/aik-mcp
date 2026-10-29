import { createHash, timingSafeEqual } from 'node:crypto'

const BEARER_PREFIX = 'Bearer '

/**
 * Placeholder values that must never be accepted as a real secret: an empty
 * key (unset variable) and the documented example value.
 */
const REFUSED_KEYS = new Set(['', 'change-me'])

const digest = (value: string): Buffer => createHash('sha256').update(value).digest()

/**
 * A key is usable when it is set and is not a documented placeholder.
 */
export const isUsableApiKey = (apiKey: string): boolean => !REFUSED_KEYS.has(apiKey.trim())

export const extractBearerToken = (authorization: string | undefined): string | undefined => {
  if (!authorization?.startsWith(BEARER_PREFIX)) return undefined
  const token = authorization.slice(BEARER_PREFIX.length).trim()
  return token.length > 0 ? token : undefined
}

/**
 * SHA-256 digests keep both operands the same length, so `timingSafeEqual`
 * never throws and never leaks the key length through response timing.
 */
export const isAuthorized = (authorization: string | undefined, apiKey: string): boolean => {
  const token = extractBearerToken(authorization)
  if (!token || !isUsableApiKey(apiKey)) return false
  return timingSafeEqual(digest(token), digest(apiKey.trim()))
}
