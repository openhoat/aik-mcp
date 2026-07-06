import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import TurndownService from 'turndown'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '..', 'rag', 'agents')

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  bulletListMarker: '-',
})

turndown.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content: string) => `~~${content}~~`,
})

turndown.addRule('removeScripts', {
  filter: ['script', 'style', 'nav', 'footer', 'header'],
  replacement: () => '',
})

interface AgentPage {
  id: string
  title: string
  url: string
}

interface AgentConfig {
  name: string
  pages: AgentPage[]
  contentSelector: string
}

interface ScrapeResult {
  id: string
  status: 'ok' | 'error'
  url: string
  error?: string
}

const AGENTS: Record<string, AgentConfig> = {
  opencode: {
    name: 'opencode',
    pages: [
      { id: 'intro', title: 'Introduction to opencode', url: 'https://opencode.ai/docs/' },
      { id: 'rules', title: 'opencode Rules', url: 'https://opencode.ai/docs/rules/' },
      { id: 'skills', title: 'opencode Skills', url: 'https://opencode.ai/docs/skills/' },
      { id: 'agents', title: 'opencode Agents', url: 'https://opencode.ai/docs/agents/' },
      { id: 'commands', title: 'opencode Commands', url: 'https://opencode.ai/docs/commands/' },
      { id: 'config', title: 'opencode Configuration', url: 'https://opencode.ai/docs/config/' },
      {
        id: 'mcp-servers',
        title: 'opencode MCP Servers',
        url: 'https://opencode.ai/docs/mcp-servers/',
      },
      {
        id: 'permissions',
        title: 'opencode Permissions',
        url: 'https://opencode.ai/docs/permissions/',
      },
      { id: 'tools', title: 'opencode Tool Reference', url: 'https://opencode.ai/docs/tools/' },
      {
        id: 'references',
        title: 'opencode References',
        url: 'https://opencode.ai/docs/references/',
      },
    ],
    contentSelector: 'main, .vp-doc, article, .content',
  },
  'claude-code': {
    name: 'claude-code',
    pages: [
      {
        id: 'overview',
        title: 'Claude Code Overview',
        url: 'https://docs.anthropic.com/en/docs/claude-code/overview',
      },
      {
        id: 'memory',
        title: 'Claude Code Memory',
        url: 'https://docs.anthropic.com/en/docs/claude-code/memory',
      },
      {
        id: 'skills',
        title: 'Claude Code Skills',
        url: 'https://docs.anthropic.com/en/docs/claude-code/skills',
      },
      {
        id: 'hooks',
        title: 'Claude Code Hooks',
        url: 'https://docs.anthropic.com/en/docs/claude-code/hooks',
      },
      {
        id: 'sub-agents',
        title: 'Claude Code Sub-Agents',
        url: 'https://docs.anthropic.com/en/docs/claude-code/sub-agents',
      },
      {
        id: 'settings',
        title: 'Claude Code Settings',
        url: 'https://docs.anthropic.com/en/docs/claude-code/settings',
      },
      {
        id: 'mcp',
        title: 'Claude Code MCP',
        url: 'https://docs.anthropic.com/en/docs/claude-code/mcp',
      },
      {
        id: 'permissions',
        title: 'Claude Code Permissions',
        url: 'https://docs.anthropic.com/en/docs/claude-code/permissions',
      },
      {
        id: 'best-practices',
        title: 'Claude Code Best Practices',
        url: 'https://docs.anthropic.com/en/docs/claude-code/best-practices',
      },
      {
        id: 'common-workflows',
        title: 'Claude Code Common Workflows',
        url: 'https://docs.anthropic.com/en/docs/claude-code/common-workflows',
      },
    ],
    contentSelector: 'main, article, .content, .doc-content, .markdown',
  },
  cline: {
    name: 'cline',
    pages: [
      { id: 'overview', title: 'Cline Overview', url: 'https://docs.cline.bot/cline-overview.md' },
      {
        id: 'rules',
        title: 'Cline Rules',
        url: 'https://docs.cline.bot/customization/cline-rules.md',
      },
      {
        id: 'skills',
        title: 'Cline Skills',
        url: 'https://docs.cline.bot/customization/skills.md',
      },
      {
        id: 'plugins',
        title: 'Cline Plugins',
        url: 'https://docs.cline.bot/customization/plugins.md',
      },
      {
        id: 'config',
        title: 'Cline Configuration',
        url: 'https://docs.cline.bot/getting-started/config.md',
      },
      {
        id: 'using-commands',
        title: 'Cline Using Commands',
        url: 'https://docs.cline.bot/core-workflows/using-commands.md',
      },
      {
        id: 'subagents',
        title: 'Cline Sub-Agents',
        url: 'https://docs.cline.bot/features/subagents.md',
      },
      {
        id: 'mcp-overview',
        title: 'Cline MCP Overview',
        url: 'https://docs.cline.bot/mcp/mcp-overview.md',
      },
      {
        id: 'memory-bank',
        title: 'Cline Memory Bank',
        url: 'https://docs.cline.bot/best-practices/memory-bank.md',
      },
      {
        id: 'cli-reference',
        title: 'Cline CLI Reference',
        url: 'https://docs.cline.bot/cli/cli-reference.md',
      },
    ],
    contentSelector: 'main, article, .content',
  },
  'gemini-cli': {
    name: 'gemini-cli',
    pages: [
      {
        id: 'overview',
        title: 'Gemini CLI Overview',
        url: 'https://google-gemini.github.io/gemini-cli/docs/',
      },
      {
        id: 'getting-started',
        title: 'Gemini CLI Getting Started',
        url: 'https://google-gemini.github.io/gemini-cli/docs/get-started/',
      },
      {
        id: 'configuration',
        title: 'Gemini CLI Configuration',
        url: 'https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html',
      },
      {
        id: 'mcp-server',
        title: 'Gemini CLI MCP Server',
        url: 'https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html',
      },
      {
        id: 'extensions',
        title: 'Gemini CLI Extensions',
        url: 'https://google-gemini.github.io/gemini-cli/docs/extensions/',
      },
      {
        id: 'custom-commands',
        title: 'Gemini CLI Custom Commands',
        url: 'https://google-gemini.github.io/gemini-cli/docs/cli/custom-commands.html',
      },
      {
        id: 'gemini-md',
        title: 'Gemini CLI Context Files (GEMINI.md)',
        url: 'https://google-gemini.github.io/gemini-cli/docs/cli/gemini-md.html',
      },
      {
        id: 'commands',
        title: 'Gemini CLI Commands Reference',
        url: 'https://google-gemini.github.io/gemini-cli/docs/cli/commands.html',
      },
      {
        id: 'tools',
        title: 'Gemini CLI Tools Overview',
        url: 'https://google-gemini.github.io/gemini-cli/docs/tools/',
      },
      {
        id: 'file-system',
        title: 'Gemini CLI File System Tools',
        url: 'https://google-gemini.github.io/gemini-cli/docs/tools/file-system.html',
      },
      {
        id: 'shell',
        title: 'Gemini CLI Shell Tool',
        url: 'https://google-gemini.github.io/gemini-cli/docs/tools/shell.html',
      },
      {
        id: 'web-fetch',
        title: 'Gemini CLI Web Fetch Tool',
        url: 'https://google-gemini.github.io/gemini-cli/docs/tools/web-fetch.html',
      },
      {
        id: 'ide-integration',
        title: 'Gemini CLI IDE Integration',
        url: 'https://google-gemini.github.io/gemini-cli/docs/ide-integration/',
      },
      {
        id: 'architecture',
        title: 'Gemini CLI Architecture',
        url: 'https://google-gemini.github.io/gemini-cli/docs/architecture.html',
      },
    ],
    contentSelector: 'main, article, .content, .doc-content, .markdown',
  },
  aider: {
    name: 'aider',
    pages: [
      {
        id: 'overview',
        title: 'Aider Overview',
        url: 'https://aider.chat/docs/usage.html',
      },
      {
        id: 'commands',
        title: 'Aider In-chat Commands',
        url: 'https://aider.chat/docs/usage/commands.html',
      },
      {
        id: 'conventions',
        title: 'Aider Coding Conventions',
        url: 'https://aider.chat/docs/usage/conventions.html',
      },
      {
        id: 'config',
        title: 'Aider Configuration',
        url: 'https://aider.chat/docs/config.html',
      },
      {
        id: 'options',
        title: 'Aider Options Reference',
        url: 'https://aider.chat/docs/config/options.html',
      },
      {
        id: 'yaml-config',
        title: 'Aider YAML Config File',
        url: 'https://aider.chat/docs/config/aider_conf.html',
      },
      {
        id: 'git',
        title: 'Aider Git Integration',
        url: 'https://aider.chat/docs/git.html',
      },
      {
        id: 'modes',
        title: 'Aider Chat Modes',
        url: 'https://aider.chat/docs/usage/modes.html',
      },
      {
        id: 'scripting',
        title: 'Aider Scripting',
        url: 'https://aider.chat/docs/scripting.html',
      },
    ],
    contentSelector: 'main, article, .content, .doc-content',
  },
  copilot: {
    name: 'copilot',
    pages: [
      {
        id: 'custom-instructions',
        title: 'GitHub Copilot Custom Instructions',
        url: 'https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot',
      },
      {
        id: 'repository-instructions',
        title: 'GitHub Copilot Repository Instructions',
        url: 'https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot',
      },
      {
        id: 'agent-instructions',
        title: 'GitHub Copilot Agent Instructions (AGENTS.md)',
        url: 'https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot?tool=webui',
      },
    ],
    contentSelector: 'main, article, .content, .markdown-body',
  },
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'aik-mcp/0.1.3 (docs scraper)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.text()
}

function extractContent(html: string, selectors: string): string {
  const selectorList = selectors.split(', ')

  for (const selector of selectorList) {
    const match = html.match(new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i'))
    if (match) {
      return match[1]
    }
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return bodyMatch ? bodyMatch[1] : html
}

function cleanMarkdown(md: string): string {
  return (
    md
      // Remove navigation breadcrumb lines like "# [gemini-cli](...)"
      .replace(/^# \[.+\]\(.+\)\n/gm, '')
      // Remove bare URLs that are navigation links
      .replace(/^https?:\/\/[^\s]+\n/gm, '')
      // Remove image references
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Remove horizontal rules
      .replace(/^\*{3,}\s*\n/gm, '')
      // Remove "This site is open source. Improve this page" footer blocks
      .replace(/This site is open source\. \[Improve this page\].+/g, '')
      // Remove "Edit this page" links
      .replace(/\[Edit this page\].+/g, '')
      // Remove "Last updated" lines
      .replace(/Last updated:?.*/gi, '')
      // Remove "On this page" navigation sections
      .replace(/\* {2}\[On this page\].*\n(\* {4}\[.*\]\(.*\)\n)*/g, '')
      // Clean escaped backticks (\` → `)
      .replace(/\\`/g, '`')
      // Collapse 3+ consecutive blank lines into 1
      .replace(/\n{3,}/g, '\n\n')
      // Trim trailing whitespace on each line
      .split('\n')
      .map(l => l.trimEnd())
      .join('\n')
      .trim()
  )
}

function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
}

async function scrapeAgent(agentKey: string): Promise<ScrapeResult[]> {
  const agent = AGENTS[agentKey]
  const agentDir = join(OUTPUT_DIR, agentKey)
  await mkdir(agentDir, { recursive: true })

  const results: ScrapeResult[] = []

  for (const page of agent.pages) {
    const filePath = join(agentDir, `${page.id}.md`)
    process.stdout.write(`  ${agentKey}/${page.id}... `)

    try {
      const html = await fetchPage(page.url)
      const contentHtml = extractContent(html, agent.contentSelector)
      const cleaned = cleanHtml(contentHtml)
      const markdown = cleanMarkdown(turndown.turndown(cleaned))

      const frontmatter = [
        '---',
        `title: "${page.title}"`,
        `source: "${page.url}"`,
        `scraped_at: "${new Date().toISOString()}"`,
        '---',
        '',
      ].join('\n')

      await writeFile(filePath, `${frontmatter + markdown}\n`)
      process.stdout.write('✓\n')
      results.push({ id: page.id, status: 'ok', url: page.url })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      process.stdout.write(`✗ (${message})\n`)
      results.push({ id: page.id, status: 'error', url: page.url, error: message })
    }
  }

  return results
}

async function main(): Promise<void> {
  process.stdout.write('Scraping agent documentation for local RAG...\n\n')

  const allResults: Record<string, ScrapeResult[]> = {}

  for (const agentKey of Object.keys(AGENTS)) {
    process.stdout.write(`\n[${agentKey}]\n`)
    const results = await scrapeAgent(agentKey)
    allResults[agentKey] = results

    const ok = results.filter(r => r.status === 'ok').length
    const err = results.filter(r => r.status === 'error').length
    process.stdout.write(`  → ${ok} ok, ${err} errors\n`)
  }

  process.stdout.write('\n=== Summary ===\n')
  let totalOk = 0
  let totalErr = 0
  for (const [agent, results] of Object.entries(allResults)) {
    const ok = results.filter(r => r.status === 'ok').length
    const err = results.filter(r => r.status === 'error').length
    process.stdout.write(`  ${agent}: ${ok} ok, ${err} errors\n`)
    totalOk += ok
    totalErr += err
  }
  process.stdout.write(`\nTotal: ${totalOk} pages scraped, ${totalErr} errors\n`)
  process.stdout.write(`Output: ${OUTPUT_DIR}/\n`)

  process.exit(totalErr > 0 ? 1 : 0)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`Fatal: ${message}\n`)
  process.exit(1)
})
