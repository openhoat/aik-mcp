declare module 'conventional-changelog' {
  import { Readable } from 'node:stream'

  interface ConventionalChangelogOptions {
    preset?: string
    config?: {
      types?: Array<{ type: string; section: string }>
    }
    releaseCount?: number
  }

  interface TransformContext {
    version?: string
  }

  interface TransformOptions {
    transform?: (commit: Record<string, unknown>) => Record<string, unknown> | undefined
  }

  function conventionalChangelog(
    options: ConventionalChangelogOptions,
    context?: TransformContext,
    gitRawCommitsOpts?: unknown,
    parserOpts?: unknown,
    writerOpts?: TransformOptions
  ): Readable

  export default conventionalChangelog
}
