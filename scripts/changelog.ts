import { writeFile } from 'node:fs/promises'
import { Writable } from 'node:stream'
import * as conventionalChangelog from 'conventional-changelog'
import type { Commit } from 'conventional-commits-parser'

// The package ships a .d.ts exposing a default export, but at runtime it only
// provides the named `ConventionalChangelog` export (ESM). Bridge via the
// default-import type, which TS resolves correctly. Script-only file, not
// shipped in the npm package.
type ConventionalChangelogInstance = {
  readPackage(): ConventionalChangelogInstance
  loadPreset(preset: string): ConventionalChangelogInstance
  config(config: unknown): ConventionalChangelogInstance
  writer(params: unknown): ConventionalChangelogInstance
  writeStream(includeDetails?: boolean): NodeJS.ReadableStream
}

type ConventionalChangelogConstructor = new (
  cwdOrGitClient?: string | unknown
) => ConventionalChangelogInstance

const ConventionalChangelog = (
  conventionalChangelog as unknown as {
    ConventionalChangelog: ConventionalChangelogConstructor
  }
).ConventionalChangelog

const TYPE_SECTIONS: Record<string, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  test: 'Tests',
  docs: 'Documentation',
  chore: 'Chores',
  refactor: 'Refactoring',
  perf: 'Performance',
  style: 'Styling',
  ci: 'Continuous Integration',
  build: 'Build System',
  revert: 'Reverts',
}

const COMMIT_HASH_LENGTH = 7

let output = ''

const writable = new Writable({
  write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void) {
    output += chunk.toString()
    callback()
  },
  final(callback: (error?: Error | null) => void) {
    writeFile('CHANGELOG.md', output.replace(/\n{3,}/g, '\n\n'))
      .then(() => callback())
      .catch(callback)
  },
})

const generator = new ConventionalChangelog()
generator
  .readPackage()
  .loadPreset('angular')
  .config({
    options: { releaseCount: 0 },
    writer: {
      transform: (commit: Commit) => {
        if (!commit.type || typeof commit.type !== 'string') return commit
        const type = commit.type.toLowerCase()
        const section = TYPE_SECTIONS[type]
        return {
          ...commit,
          ...(section ? { type: section } : {}),
          ...(typeof commit.hash === 'string'
            ? { shortHash: commit.hash.substring(0, COMMIT_HASH_LENGTH) }
            : {}),
        }
      },
    },
  })
  .writer({
    groupBy: 'type',
    commitGroupsSort: 'title',
    commitsSort: ['scope', 'subject'],
  })
  .writeStream()
  .pipe(writable)
