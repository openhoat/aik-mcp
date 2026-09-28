# Kanban Board

## Backlog

### #1 [ARCHITECTURE] Remote content sources — support GitHub/Git/HTTP URLs (single source, local + remote) (P2)

- [ ] Implementation

### #2 [ARCHITECTURE] Add Cursor agent support — `.cursor/rules/` uses markdown with frontmatter, close to aik's native format (P2)

- [ ] Implementation

### #8 [DEVOPS] Docker image publication to ghcr.io (P2)

- [ ] Create `.github/workflows/docker.yml` (trigger on tag `v*`)
- [ ] Push to `ghcr.io/openhoat/aik-mcp` (version + sha tags)

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

### #14 [CONFIG] Stricter npm `files` field — exclude test artifacts (P3)

- [ ] Update `"files"` to exclude `build/**/*.test.js` and `build/**/*.test.d.ts`

### #15 [DEVOPS] GitHub release from CHANGELOG (P3)

- [ ] Port `scripts/github-release.mjs` from rag-hub-mcp
- [ ] Create `.github/workflows/release.yml` (trigger on tag `v*.*.*`)
- [ ] Replace `softprops/action-gh-release@v3` in `publish.yml`

## In Progress
