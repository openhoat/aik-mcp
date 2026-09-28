# Kanban Board

## Backlog

### #5 [DEVOPS] Wireit CI caching — speed up CI with incremental build cache (P1)

- [ ] Add `google/wireit@setup-github-actions-caching/v2` to `ci.yml`
- [ ] Replace the discrete validate steps with a single `npm run validate`

### #6 [TEST] Coverage thresholds — enforce minimum line/branch coverage (P1)

- [ ] Add thresholds to `vitest.config.ts` (lines 75, functions 60, branches 65, statements 75)
- [ ] Set `reportsDirectory: 'dist/coverage'` to align with rag-hub-mcp

### #7 [ARCHITECTURE] Architecture linting with dependency-cruiser (P1)

- [ ] Add the `dependency-cruiser` devDependency
- [ ] Create `.dependency-cruiser.mjs` (no-circular + layer rules: resources/tools/transports/shared)
- [ ] Add a `qa:arch` wireit script and include it in `validate`

### #1 [ARCHITECTURE] Remote content sources — support GitHub/Git/HTTP URLs (single source, local + remote) (P2)

- [ ] Implementation

### #2 [ARCHITECTURE] Add Cursor agent support — `.cursor/rules/` uses markdown with frontmatter, close to aik's native format (P2)

- [ ] Implementation

### #8 [DEVOPS] Docker image publication to ghcr.io (P2)

- [ ] Create `.github/workflows/docker.yml` (trigger on tag `v*`)
- [ ] Push to `ghcr.io/openhoat/aik-mcp` (version + sha tags)

### #9 [TEST] vitest setup file — centralized test env initialization (P2)

- [ ] Create `vitest.setup.ts` (LOG_LEVEL, NODE_ENV, temp dir if needed)
- [ ] Reference it in `vitest.config.ts` via `setupFiles`
- [ ] Remove the inline `env: { LOG_LEVEL: 'silent' }` from the config

### #10 [DEPENDENCIES] Upgrade Node 22 → 24 (P2)

- [ ] Update the `volta` field in `package.json` (node 24.21.0, npm 11.19.1)
- [ ] Update `.npmrc` (`use-node-version=24.21.0`, add `cache=./.npm`)
- [ ] Update the `engines` field
- [ ] Update the Dockerfile base image to `node:24-alpine`
- [ ] Update `node-version` in `ci.yml` and `publish.yml`

### #11 [CONFIG] Prettier for markdown formatting (P2)

- [ ] Add the `prettier` devDependency and a `.prettierignore`
- [ ] Add `qa:prettier` (check) and `qa:prettier:fix` wireit scripts
- [ ] Include them in the `qa` composite and `qa:fix`

### #12 [CONFIG] .env.example — document all environment variables (P2)

- [ ] Create `.env.example` documenting `AIK_CONTENT_DIR`, `LOG_LEVEL`, `NODE_ENV`, `PORT`, etc.

### #3 [ARCHITECTURE] Add Gemini CLI agent support — MCP-compatible, investigate extension format for content installation (P3)

- [ ] Implementation

### #4 [ARCHITECTURE] Add Antigravity CLI (agy) agent support — Google's AI coding agent, investigate skill/extension format (P3)

- [ ] Implementation

### #13 [ARCHITECTURE] Separate unit/e2e test projects (P3)

- [ ] Split the vitest config into `unit` and `e2e` projects
- [ ] Move `src/e2e.e2e.test.ts` to `src/test/e2e/`
- [ ] Add `test:unit` and `test:e2e` wireit scripts

### #14 [CONFIG] Stricter npm `files` field — exclude test artifacts (P3)

- [ ] Update `"files"` to exclude `build/**/*.test.js` and `build/**/*.test.d.ts`

### #15 [DEVOPS] GitHub release from CHANGELOG (P3)

- [ ] Port `scripts/github-release.mjs` from rag-hub-mcp
- [ ] Create `.github/workflows/release.yml` (trigger on tag `v*.*.*`)
- [ ] Replace `softprops/action-gh-release@v3` in `publish.yml`

## In Progress
