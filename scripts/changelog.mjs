import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { Writable } from 'node:stream'
import conventionalChangelog from 'conventional-changelog'

let newContent = ''

const writable = new Writable({
  write(chunk, _encoding, callback) {
    newContent += chunk.toString()
    callback()
  },
  final(callback) {
    if (existsSync('CHANGELOG.md')) {
      readFile('CHANGELOG.md', 'utf-8')
        .then(existingContent => {
          const updatedContent = newContent + existingContent
          return writeFile('CHANGELOG.md', updatedContent)
        })
        .then(() => callback())
        .catch(callback)
    } else {
      writeFile('CHANGELOG.md', newContent)
        .then(() => callback())
        .catch(callback)
    }
  },
})

conventionalChangelog(
  {
    preset: 'angular',
    config: {
      types: [
        { type: 'feat', section: 'Features' },
        { type: 'fix', section: 'Bug Fixes' },
        { type: 'test', section: 'Tests' },
        { type: 'docs', section: 'Documentation' },
        { type: 'chore', section: 'Chores' },
        { type: 'refactor', section: 'Refactoring' },
        { type: 'perf', section: 'Performance' },
        { type: 'style', section: 'Styling' },
        { type: 'revert', section: 'Reverts' },
      ],
    },
    releaseCount: 0,
  },
  {
    version: 'Unreleased',
  }
).pipe(writable)
