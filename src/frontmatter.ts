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

export const parseFrontmatter = (raw: string): ParsedDoc => {
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
    parsed = (parse(yamlBlock) ?? {}) as Record<string, unknown>
  } catch {
    parsed = {}
  }

  const frontmatter = frontmatterSchema.parse(parsed)
  return { frontmatter, body }
}

export const frontmatterStrictSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  tags: z.array(z.string()).min(1, 'at least one tag is required'),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'version must be in semver format (e.g. 1.0.0)')
    .optional(),
})

export function validateFrontmatter(
  data: Record<string, unknown>
): { valid: true } | { valid: false; errors: string[] } {
  const result = frontmatterStrictSchema.safeParse(data)
  if (result.success) return { valid: true }
  return {
    valid: false,
    errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
  }
}

export const serializeFrontmatter = (frontmatter: Frontmatter): string => {
  const obj: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      obj[key] = value
    }
  }
  return stringify(obj).trim()
}
