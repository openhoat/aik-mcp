# Kanban Board

## Backlog

- [ ] **[ARCHITECTURE]** Enrich built-in MCP server instructions with discovery, consumption, and lifecycle flows (P1, impact: high, effort: medium)
- [ ] **[CONFIG]** Add docs page "Content Authoring" — guide for writing good rules and skills (P1, impact: high, effort: low)
- [ ] **[TEST]** Test `index.ts` — server entry point has zero coverage (P2, impact: medium, effort: low)
- [ ] **[TEST]** Test `http.ts` — HTTP transport is at 5% coverage (P2, impact: medium, effort: medium)
- [ ] **[ARCHITECTURE]** Add Zod schema to validate content file frontmatter (P2, impact: medium, effort: medium)
- [ ] **[UX]** Add `aik validate` CLI to validate content consistency (P2, impact: high, effort: medium)
- [ ] **[UX]** Support `.aikrc.json` config file via `--config` flag (P2, impact: medium, effort: medium)
- [ ] **[CONFIG]** Add docs page "Architecture" — detailed MCP flow diagram (P2, impact: medium, effort: low)
- [ ] **[CONFIG]** Add docs page "Deployment" — Docker, PM2, systemd, HTTPS reverse proxy (P2, impact: medium, effort: medium)
- [ ] **[CONFIG]** Add docs page "API Reference" — complete MCP tool schemas (P2, impact: medium, effort: low)
- [ ] **[ARCHITECTURE]** Create `scaffold-mcp-tool` skill — template for creating a new MCP tool (P2, impact: high, effort: medium)
- [ ] **[ARCHITECTURE]** Create `rule-template` template — scaffold for a new rule (P2, impact: medium, effort: low)
- [ ] **[ARCHITECTURE]** Create `content-curator` agent — validates aik content quality (P2, impact: medium, effort: medium)
- [ ] **[DEVOPS]** Docker image — Dockerfile + docker-compose.yml for HTTP deployment (P2, impact: high, effort: low)
- [ ] **[DEVOPS]** Automated release — GitHub Actions workflow to publish to npm on merge (P2, impact: high, effort: medium)
- [ ] **[DEVOPS]** Codecov upload — add codecov-action to CI (P2, impact: medium, effort: low)
- [ ] **[DEVOPS]** Renovate/Dependabot config for automated dependency PRs (P2, impact: medium, effort: low)
- [ ] **[TEST]** Cover remaining untested branches in `content-store.ts` (lines 128-156) (P3, impact: low, effort: low)
- [ ] **[ARCHITECTURE]** Replace generic `Error` with typed errors (`ContentNotFoundError`, etc.) (P3, impact: low, effort: low)
- [ ] **[UX]** Enrich health check (`GET /health`) with `itemCount`, `categories`, `uptime` (P3, impact: low, effort: low)
- [ ] **[PERFORMANCE]** Add pagination (`limit`/`offset`) to `aik_list` tool (P3, impact: low, effort: low)
- [ ] **[PERFORMANCE]** Invalidate cache on `aik_get` when file changes on disk (P3, impact: low, effort: medium)
- [ ] **[CONFIG]** Add dark mode logo variant for VitePress site (P3, impact: low, effort: low)
- [ ] **[CONFIG]** Enable VitePress search bar (`local-search`) (P3, impact: low, effort: very low)
- [ ] **[ARCHITECTURE]** Create `api-design` rule for API conventions (P3, impact: medium, effort: low)
- [ ] **[ARCHITECTURE]** Create enriched `git-commit-conventions` rule (P3, impact: low, effort: low)
- [ ] **[ARCHITECTURE]** Create `content-review` workflow — content review process (P3, impact: medium, effort: low)
- [ ] **[DEVOPS]** Clean up obsolete `preset`/`includes` keys in `biome.json` (P3, impact: low, effort: low)
- [ ] **[UX]** Make watch mode notification visible on reload (P3, impact: low, effort: low)
- [ ] **[UX]** Structured JSON logs in production mode (P3, impact: medium, effort: low)

## In Progress

## Done

- [x] **[MEDIUM]** [refactor] — Migrer de Jest vers Vitest

- [x] **[HIGH]** [test] — Phase 1: config.ts, logger.ts, shared.ts unit tests (quick wins)
- [x] **[HIGH]** [test] — Phase 1: removeSections() unit test (uninstall.ts)
- [x] **[HIGH]** [test] — Phase 1: parseSemver() / isNewer() unit tests (update.ts)
- [x] **[HIGH]** [test] — Phase 1: list / get / write / delete handlers unit tests
- [x] **[MEDIUM]** [test] — Phase 2: install.ts full test suite
- [x] **[MEDIUM]** [test] — Phase 2: uninstall.ts full test suite
- [x] **[MEDIUM]** [test] — Phase 2: list-installed.ts unit tests
- [x] **[MEDIUM]** [test] — Phase 2: update.ts full test suite
- [x] **[MEDIUM]** [test] — Phase 3: resources/index.ts test suite (100% coverage)
- [x] **[MEDIUM]** [test] — Phase 3: content-store.ts coverage (+15% to 75.7% stmts, 56.5% branches)
- [x] **[MEDIUM]** [docs] — Fix README opencode config (remove .mcp.json reference, use .opencode/opencode.jsonc) and remove redundant badges
- [x] **[MEDIUM]** [infra] — Set up custom changelog generator script including all commit types (test/chore/docs/refactor/perf/style)
- [x] **[MEDIUM]** [docs] — Update aik knowledge base: create changelog-script template, update generate-changelog skill, update log_changes rule, update worktree rule (allow main commits)
