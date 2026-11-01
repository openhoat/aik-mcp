import { readFileSync } from 'node:fs'

// The version this server reports in `serverInfo`, which is how a client tells
// which build it is talking to — and, indirectly, which plan contract it may
// expect. Hardcoding it makes the answer wrong from the second release onward.
//
// The relative path holds in all three layouts: `src/version.ts` under tsx, the
// compiled `build/version.js`, and the entry point of the npm package and the
// container image. All of them sit one level below the package root, beside
// `package.json`.
const PACKAGE_JSON = new URL('../package.json', import.meta.url)

interface PackageJson {
  version: string
}

const isPackageJson = (value: unknown): value is PackageJson => {
  if (typeof value !== 'object' || value === null || !('version' in value)) return false
  return typeof value.version === 'string'
}

/**
 * Version of the running package, as published.
 *
 * Read at import time on purpose: a package that cannot name its own version is
 * broken, and failing at startup beats reporting a plausible lie.
 */
export const packageVersion = (): string => {
  const parsed: unknown = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'))
  if (!isPackageJson(parsed)) {
    throw new Error(`cannot read the version from ${PACKAGE_JSON.pathname}`)
  }
  return parsed.version
}
