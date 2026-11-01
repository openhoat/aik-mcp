import type { ServerResponse } from 'node:http'
import { dirname } from 'node:path'
import type { ContentStore } from '../content-store.js'
import { logger } from '../logger.js'
import { type Agent, getAllAgents, getSupportedCategories } from '../tools/agents/factory.js'
import { planInstall } from '../tools/agents/plan.js'
import type { Scope } from '../tools/agents/types.js'
import type { HttpRoute } from './http.js'

const PLAN_PREFIX = '/plan/'

const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload, null, 2))
}

const sendText = (res: ServerResponse, status: number, message: string): void => {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(message)
}

const isAgent = (value: string): value is Agent => getAllAgents().some(agent => agent === value)

const isScope = (value: string): value is Scope => value === 'project' || value === 'global'

/**
 * `GET /plan/<itemPath>?agent=&scope=&configPath=` returns the same installation
 * plan as the `install` tool, so a shell script can fetch and apply it without
 * the model re-emitting large payloads. Bearer auth is enforced by the transport
 * before any route runs.
 */
export const createPlanRoute = (store: ContentStore): HttpRoute => ({
  match: url => url.pathname.startsWith(PLAN_PREFIX),
  handle: async (url: URL, res: ServerResponse) => {
    const rawPath = decodeURIComponent(url.pathname.slice(PLAN_PREFIX.length))
    const itemPath = rawPath.replace(/\/+$/, '').replace(/\.md$/i, '').replace(/\/+$/, '')
    const agent = url.searchParams.get('agent') ?? 'opencode'
    const scope = url.searchParams.get('scope') ?? 'project'
    const configPath = url.searchParams.get('configPath')

    logger.trace({ itemPath, agent, scope }, 'plan route called')

    if (!itemPath) {
      sendText(res, 400, 'Missing item path: GET /plan/<category>/<name>')
      return
    }
    if (!isAgent(agent)) {
      sendText(res, 400, `Unknown agent: ${agent} (expected one of ${getAllAgents().join(', ')})`)
      return
    }
    if (!isScope(scope)) {
      sendText(res, 400, `Unknown scope: ${scope} (expected project or global)`)
      return
    }

    const item = store.getByPath(itemPath)
    if (!item) {
      sendText(res, 404, `Content not found: ${itemPath}`)
      return
    }
    if (!getSupportedCategories(agent, scope).includes(item.category)) {
      sendText(
        res,
        400,
        `Category "${item.category}" is not supported for ${scope} scope with agent "${agent}"`
      )
      return
    }

    const plan = planInstall(
      agent,
      {
        path: item.path,
        category: item.category,
        name: item.name,
        title: item.title,
        rawContent: store.readContent(item.path) ?? item.content,
        sourceDir: dirname(item.fullPath),
      },
      { scope, version: item.version, configPath }
    )

    sendJson(res, 200, plan)
  },
})
