import { parse, stringify } from 'yaml'
import { z } from 'zod'

export const frontmatterSchema = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  version: z.string().default('1.0.0'),
  compatibility: z.array(z.string()).default(['opencode', 'claude-code', 'cline']),
  author: z.string().default(''),
  created: z.string().default(''),
  updated: z.string().default(''),
})

export type Frontmatter = z.infer<typeof frontmatterSchema>

export interface ParsedDoc {
  frontmatter: Frontmatter
  body: string
}

export function parseFrontmatter(raw: string): ParsedDoc {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith('---')) {
    return { frontmatter: frontmatterSchema.parse({}), body: raw }
  }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) {
    return { frontmatter: frontmatterSchema.parse({}), body: raw }
  }

  const yamlBlock = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 3).trimStart()

  let parsed: Record<string, unknown>
  try {
    parsed = (parse(yamlBlock) as Record<string, unknown>) ?? {}
  } catch {
    parsed = {}
  }

  const frontmatter = frontmatterSchema.parse(parsed)
  return { frontmatter, body }
}

export function serializeFrontmatter(frontmatter: Frontmatter): string {
  const obj: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      obj[key] = value
    }
  }
  return stringify(obj).trim()
}
