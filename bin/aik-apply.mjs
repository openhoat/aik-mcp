#!/usr/bin/env node
// aik-apply — apply an installation plan on this machine.
//
// Over HTTP the server plans an installation instead of performing it (it does not
// run on the machine that holds the installation). This command is the client
// half: it reads a plan from a file or stdin and performs its operations where it
// runs, verifying every sha256 before writing.
//
//   curl -fsS -H "Authorization: Bearer $AIK_API_KEY" \
//     "https://aik-mcp.example.com/plan/rules/typescript?agent=opencode&scope=global" \
//     -o plan.json
//   aik-apply plan.json
//
// The operations are the ones described in the bundled "aik-knowledge-content"
// rule; this command applies exactly that contract.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const USAGE = `Usage: aik-apply [PLAN] [options]

Apply an aik installation plan on this machine. PLAN is a plan file, or - (the
default) to read the plan from stdin.

Options:
  --base DIR   base directory for the project scope (default: current directory)
  --dry-run    resolve and verify the plan, change nothing
  -h, --help   show this help

The plan payload is what "install" and "uninstall" return over HTTP, or what
GET /plan/<item>?agent=<agent>&scope=<scope> serves.
`

const here = dirname(fileURLToPath(import.meta.url))

// The applier lives in the compiled package: one implementation, shared with the
// parity tests. A source checkout must be built first.
const loadApplier = async () => {
  const target = resolve(here, '..', 'build', 'tools', 'agents', 'apply.js')
  try {
    return await import(pathToFileURL(target).href)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`cannot load the applier from ${target} (${message}). Run "npm run build".`)
  }
}

const die = message => {
  process.stderr.write(`aik-apply: ${message}\n`)
  process.exit(1)
}

const parseArgs = argv => {
  const options = { plan: '-', base: undefined, dryRun: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      options.help = true
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--base') {
      const value = argv[++i]
      if (!value) die('--base needs a directory')
      options.base = value
    } else if (arg === '-') {
      options.plan = '-'
    } else if (arg.startsWith('-')) {
      die(`unknown option "${arg}" (try --help)`)
    } else {
      options.plan = arg
    }
  }
  return options
}

const readPlan = planPath => {
  const raw = planPath === '-' ? readFileSync(0, 'utf-8') : readFileSync(planPath, 'utf-8')
  if (!raw.trim()) throw new Error('empty plan (nothing on stdin, or an empty file)')
  const plan = JSON.parse(raw)
  if (typeof plan !== 'object' || plan === null || !Array.isArray(plan.actions)) {
    throw new Error('this is not an aik plan: no "actions" array')
  }
  return plan
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(USAGE)
    return
  }

  const { applyPlan, describePlan, resolveBaseDir } = await loadApplier()
  const plan = readPlan(options.plan)

  if (typeof plan.planVersion === 'number' && plan.planVersion > 1) {
    process.stderr.write(
      `aik-apply: plan version ${plan.planVersion} is newer than this command knows (1): upgrade aik-mcp if an operation fails\n`
    )
  }

  const base = resolveBaseDir(plan, options.base)
  process.stdout.write(`${describePlan(plan)} into ${base}\n`)
  for (const warning of plan.warnings ?? []) {
    process.stdout.write(`  warning: ${warning}\n`)
  }

  const result = applyPlan(plan, {
    base,
    dryRun: options.dryRun,
    log: message => process.stdout.write(`  ${message}\n`),
  })

  if (plan.summary) process.stdout.write(`  ${plan.summary}\n`)
  const suffix = options.dryRun ? ' (dry run, nothing written)' : ''
  process.stdout.write(`  ${result.applied} applied, ${result.skipped} skipped${suffix}\n`)
}

try {
  await main()
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
}
