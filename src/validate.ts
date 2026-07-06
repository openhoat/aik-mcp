import type { ContentStore } from './content-store.js'
import { validateFrontmatter } from './frontmatter.js'

const VALID_CATEGORIES = ['rules', 'skills', 'workflows', 'agents', 'commands', 'templates']

export interface ValidationIssue {
  path: string
  errors: string[]
}

export interface ValidationResult {
  total: number
  valid: number
  invalid: number
  issues: ValidationIssue[]
}

export const validateContent = (store: ContentStore): ValidationResult => {
  const items = store.getAll()
  const issues: ValidationIssue[] = []

  for (const item of items) {
    const errors: string[] = []

    const fmValidation = validateFrontmatter({
      title: item.title,
      description: item.description,
      tags: item.tags,
      version: item.version,
    })
    if (!fmValidation.valid) {
      errors.push(...fmValidation.errors)
    }

    if (item.content.trim().length === 0) {
      errors.push('body: content body is empty')
    }

    if (!VALID_CATEGORIES.includes(item.category)) {
      errors.push(`category: "${item.category}" is not a valid category`)
    }

    if (errors.length > 0) {
      issues.push({ path: item.path, errors })
    }
  }

  return {
    total: items.length,
    valid: items.length - issues.length,
    invalid: issues.length,
    issues,
  }
}

export const formatResult = (
  result: ValidationResult,
  allPaths: string[],
  json: boolean
): string => {
  if (json) {
    return JSON.stringify(result, null, 2)
  }

  const lines: string[] = []
  const issueMap = new Map(result.issues.map(i => [i.path, i]))
  for (const path of allPaths) {
    const issue = issueMap.get(path)
    if (issue) {
      lines.push(`✗ ${path} — ${issue.errors.join(', ')}`)
    } else {
      lines.push(`✓ ${path}`)
    }
  }

  lines.push('')
  lines.push(`${result.valid} valid, ${result.invalid} invalid`)
  return lines.join('\n')
}
