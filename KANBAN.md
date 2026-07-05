# Kanban Board

## Backlog

- [ ] **[ARCHITECTURE]** Enrichir les instructions built-in du serveur MCP pour couvrir la découverte, la consommation et le cycle de vie du contenu (P1, impact: high, effort: medium)
- [ ] **[CONFIG]** Page docs "Content Authoring" — guide pour écrire de bonnes règles et skills (P1, impact: high, effort: low)
- [ ] **[TEST]** Tester `index.ts` — le point d'entrée du serveur n'a aucune couverture (P2, impact: medium, effort: low)
- [ ] **[TEST]** Tester `http.ts` — le transport HTTP est à 5% de couverture (P2, impact: medium, effort: medium)
- [ ] **[ARCHITECTURE]** Ajouter un schéma Zod pour valider le frontmatter des fichiers de contenu (P2, impact: medium, effort: medium)
- [ ] **[UX]** Ajouter une CLI `aik validate` pour valider la cohérence du contenu (P2, impact: high, effort: medium)
- [ ] **[UX]** Support d'un fichier de config `.aikrc.json` via `--config` (P2, impact: medium, effort: medium)
- [ ] **[CONFIG]** Page docs "Architecture" — diagramme détaillé du flux MCP (P2, impact: medium, effort: low)
- [ ] **[CONFIG]** Page docs "Deployment" — Docker, PM2, systemd, reverse proxy HTTPS (P2, impact: medium, effort: medium)
- [ ] **[CONFIG]** Page docs "API Reference" — schémas complets des outils MCP (P2, impact: medium, effort: low)
- [ ] **[ARCHITECTURE]** Créer un skill `scaffold-mcp-tool` — template pour créer un tool MCP (P2, impact: high, effort: medium)
- [ ] **[ARCHITECTURE]** Créer un template `rule-template` pour scaffold de nouvelle règle (P2, impact: medium, effort: low)
- [ ] **[ARCHITECTURE]** Créer un agent `content-curator` pour valider la qualité du contenu aik (P2, impact: medium, effort: medium)
- [ ] **[DEVOPS]** Docker image — Dockerfile + docker-compose.yml pour déployer en HTTP (P2, impact: high, effort: low)
- [ ] **[DEVOPS]** Release automatisée — workflow GitHub Actions pour publier sur npm au merge (P2, impact: high, effort: medium)
- [ ] **[DEVOPS]** Codecov upload — ajouter codecov-action dans la CI (P2, impact: medium, effort: low)
- [ ] **[DEVOPS]** Config Renovate/Dependabot pour auto-PR de mise à jour de dépendances (P2, impact: medium, effort: low)
- [ ] **[TEST]** Couvrir les dernières branches non testées de `content-store.ts` (lignes 128-156) (P3, impact: low, effort: low)
- [ ] **[ARCHITECTURE]** Remplacer les `Error` génériques par des erreurs typées (`ContentNotFoundError`, etc.) (P3, impact: low, effort: low)
- [ ] **[UX]** Enrichir le health check (`GET /health`) avec `itemCount`, `categories`, `uptime` (P3, impact: low, effort: low)
- [ ] **[PERFORMANCE]** Ajouter pagination `limit`/`offset` sur le tool `aik_list` (P3, impact: low, effort: low)
- [ ] **[PERFORMANCE]** Invalider le cache sur `aik_get` si le fichier a changé sur disque (P3, impact: low, effort: medium)
- [ ] **[CONFIG]** Variante logo dark mode pour le site VitePress (P3, impact: low, effort: low)
- [ ] **[CONFIG]** Activer la search bar VitePress (`local-search`) (P3, impact: low, effort: very low)
- [ ] **[ARCHITECTURE]** Créer une règle `api-design` pour les conventions d'API (P3, impact: medium, effort: low)
- [ ] **[ARCHITECTURE]** Créer une règle `git-commit-conventions` enrichie (P3, impact: low, effort: low)
- [ ] **[ARCHITECTURE]** Créer un workflow `content-review` pour le processus de review de contenu (P3, impact: medium, effort: low)
- [ ] **[DEVOPS]** Nettoyer les erreurs `preset`/`includes` obsolètes dans `biome.json` (P3, impact: low, effort: low)
- [ ] **[UX]** Mode watch avec notification visible au reload (P3, impact: low, effort: low)
- [ ] **[UX]** Logs structurés JSON en production (P3, impact: medium, effort: low)

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
