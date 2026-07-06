import { writeFile } from 'node:fs/promises'
import { Writable } from 'node:stream'
import conventionalChangelog from 'conventional-changelog'

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

conventionalChangelog(
  {
    preset: 'angular',
    config: {
      types: Object.entries(TYPE_SECTIONS).map(([type, section]) => ({
        type,
        section,
      })),
    },
    releaseCount: 0,
  },
  { version: 'Unreleased' },
  undefined,
  undefined,
  {
    transform: (commit: { type?: unknown; hash?: unknown; [key: string]: unknown }) => {
      if (!commit.type || typeof commit.type !== 'string') return commit
      const type = commit.type.toLowerCase()
      const section = TYPE_SECTIONS[type]
      return {
        ...commit,
        ...(section ? { type: section } : {}),
        ...(typeof commit.hash === 'string' ? { shortHash: commit.hash.substring(0, 7) } : {}),
      }
    },
  }
).pipe(writable)
