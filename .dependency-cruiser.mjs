/**
 * Architecture rules for aik-mcp.
 *
 * Layers (a layer may only depend on layers below it):
 *   transports  -> entry points (stdio, http)
 *   tools       -> MCP tool handlers (including agent adapters under tools/agents)
 *   resources   -> MCP resource handlers
 *   core        -> root modules (config, content-store, frontmatter, ...)
 *
 * `index.ts` is the composition root: it may depend on every layer.
 * Test files are excluded from the architecture rules.
 */
export default {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make the code hard to reason about and to test.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Modules that nothing imports are dead code.',
      from: {
        orphan: true,
        pathNot: ['\\.(unit|e2e)\\.test\\.ts$', '(^|/)index\\.ts$', '(^|/)types\\.ts$'],
      },
      to: {},
    },
    {
      name: 'core-stays-lean',
      severity: 'error',
      comment: 'Core modules must not depend on tools, resources or transports.',
      from: { path: '^src/[^/]+\\.ts$', pathNot: '^src/index\\.ts$' },
      to: { path: '^src/(tools|resources|transports)/' },
    },
    {
      name: 'resources-stay-lean',
      severity: 'error',
      comment: 'The resources layer must not depend on tools or transports.',
      from: { path: '^src/resources/' },
      to: { path: '^src/(tools|transports)/' },
    },
    {
      name: 'tools-stay-lean',
      severity: 'error',
      comment: 'The tools layer must not depend on resources or transports.',
      from: { path: '^src/tools/' },
      to: { path: '^src/(resources|transports)/' },
    },
    {
      name: 'agent-adapters-are-leaves',
      severity: 'error',
      comment: 'Agent adapters must not depend on the tools that consume them.',
      from: { path: '^src/tools/agents/' },
      to: { path: '^src/tools/[^/]+\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    exclude: { path: ['\\.(unit|e2e)\\.test\\.ts$'] },
    parser: 'swc',
  },
}
