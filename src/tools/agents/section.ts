// Delimitation of an item's section inside a shared markdown file (AGENTS.md,
// copilot-instructions.md, ...).
//
// One implementation, used by the direct engine and by the plan applier that
// ships in the package: a section is a `##` heading whose first non-blank line
// is a `<source>path</source>` marker, and it ends at the next heading that opens
// on a marker, or at the end of the file. The body of a section is content, and
// content carries its own `##` headings (`## Objective`, `## Rules`), so a bare
// heading is not a boundary. Bounding on headings alone cut removals in half and
// left the rest orphaned in the file, with the marker gone.

export interface SectionRange {
  start: number
  end: number
}

// The marker line that identifies an item inside a shared file.
export const sectionMarker = (itemPath: string): string => `<source>${itemPath}</source>`

export const isMarkerLine = (line: string | null): boolean => {
  return line !== null && /^<source>[^\s]+<\/source>$/.test(line)
}

// First non-blank line after a heading, i.e. what the section opens with.
export const openingLine = (lines: string[], heading: number): string | null => {
  for (let i = heading + 1; i < lines.length; i++) {
    if (lines[i].trim() !== '') return lines[i].trim()
  }
  return null
}

/**
 * Locate the section carrying `marker`, as a line range (end exclusive).
 */
export const findSection = (content: string, marker: string): SectionRange | null => {
  const lines = content.split('\n')
  const start = lines.findIndex(
    (line, index) => line.startsWith('## ') && openingLine(lines, index) === marker
  )
  if (start < 0) return null

  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ') && isMarkerLine(openingLine(lines, i))) {
      end = i
      break
    }
  }

  return { start, end }
}

/** True when the file already carries the section for `marker`. */
export const sectionPresent = (content: string, marker: string): boolean =>
  findSection(content, marker) !== null

// Removes every `##` block for which `isTarget` holds, bounding each block on
// the next heading of any kind. Only the legacy fallback below uses it.
export const removeSections = (
  content: string,
  isTarget: (text: string) => boolean
): { result: string; count: number } => {
  const lines = content.split('\n')
  const kept: string[] = []
  let count = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ') && isTarget(lines.slice(i).join('\n'))) {
      count++
      i++
      while (i < lines.length && !lines[i].startsWith('## ')) {
        i++
      }
      continue
    }

    kept.push(line)
    i++
  }

  return { result: kept.join('\n'), count }
}

export const removeSection = (
  content: string,
  marker: string
): { result: string; count: number } => {
  const range = findSection(content, marker)
  if (!range) {
    // Legacy fallback: a marker that is not the opening line of its heading means
    // the file was not written by this engine. Do what the previous version did
    // rather than refuse, but never worse.
    if (!content.includes(marker)) return { result: content, count: 0 }
    return removeSections(content, text => text.includes(marker))
  }

  const lines = content.split('\n')
  const kept = [...lines.slice(0, range.start), ...lines.slice(range.end)]
  return { result: kept.join('\n'), count: 1 }
}

// The text of a new section: blank separator, heading, marker, body.
export const buildSection = (heading: string, marker: string, body: string): string =>
  `\n${heading}\n\n${marker}\n\n${body.trimEnd()}\n`
