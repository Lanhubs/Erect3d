# Changelog

## Unreleased

- Repository-level installation, testing and production-build commands for the editor,
  API and standalone film.
- Active CI, coverage baselines, dependency auditing, secret scanning and reviewed update configuration.
- Coverage floors are now recorded per Bun release (`tools/coverage-baselines.json` keyed by
  `Bun.version`), and the measured release is published in `coverage/summary.json`. The single
  unlabeled set compared 1.4.4 numbers against 1.4.2 floors — the same files measure 25595 lines /
  2380 functions under 1.4.4 against 27001 / 2419 under 1.4.2 — so every package appeared to
  regress. The original floors stand unchanged; a new release without its own recorded set now
  stops the run instead of comparing instruments.
- Development/test setup documentation and separate disposable database configuration.
- Structured diagnostics with safe error context and optional bounded self-hosted OTLP export.
- One `api/src/logging.ts` entry point for the JSON logger, with request correlation, level
  escalation and error classification now covered end to end through the HTTP middleware.
- pino added as the JSON emitter behind that unchanged contract: one framed document per event,
  text levels, no `pid`/`hostname`, writes through the same `console.log` sink as before and the
  same credential redaction. The last `console.*` call in API runtime source is gone.
- All 28 API integration suites, the Redis suite and `bun run check:startup` executed against
  disposable loopback-only containers: 93 tests in 28 files pass, and the repository total with a
  database is 651 tests with 650 passing. That run corrected the logger sink, which had moved to
  `process.stdout.write` and left `api/tests/jobs.integration.test.ts` unable to observe
  `job.failed`; only the unit half of the suite can hide that, so it is recorded as a defect found
  by the database run rather than a passing result all along.
- Optional Sentry incident reporting (`api/src/monitoring.ts`, `@sentry/bun` + `@sentry/hono`):
  inert while `SENTRY_DSN` is empty, one policy for HTTP and worker failures, Sentry 11
  `dataCollection` switched off for cookies, headers, bodies, query strings, stack-frame locals
  and source lines, `beforeSend` re-scrubbing every exception string, `app.onError` still the only
  response contract and both entrypoints flushing before exit. `SENTRY_DSN`/`SENTRY_RELEASE` are
  documented in `api/.env.example` and validated with the other endpoint settings, which moved the
  schema checks into `api/src/config/validate.ts`.
- One Bun workspace lockfile (`bun.lock` at the repository root) for the editor, API and film
  packages, replacing the three per-package lockfiles, so a single
  `bun install --frozen-lockfile` resolves every declared dependency and its transitive closure.
  `tests/dependency-health.test.ts` now guards the lock, the shared resolutions and the Bun pin.
- DWG/DXF plan import through a bounded conversion worker, and DXF/DWG sheet export for CAD tools.
- A `bun run test` that runs the database-free suites and prints every integration suite it skipped,
  alongside explicit `test:unit` and `test:integration` commands.
- Per-package file-size guards run from `bun run typecheck`: recorded legacy files are frozen at
  their measured line counts and any other source file is capped at 200 lines.
- The largest editor modules (3D viewport, workspace shell, inspector, structure panel and proposal
  review) were divided into focused components and hooks, with viewport bounds and review state
  extracted under test. This is internal structure only; no interface, model or rendering behavior
  changed.
- Tailwind CSS declared in the client manifest and registered as a Vite plugin, so a clean clone
  installs from the committed lockfile and builds the editor stylesheet. Known consequence: the
  plugin drops the stylesheet's remote Google Fonts `@import` instead of hoisting it, so the built
  CSS no longer requests `DM Sans` or `IBM Plex Mono` even though it still names them. The evidence
  and the one-line remedy are recorded in `docs/REASSESSMENT.md`.
- Consistent formatting maintained separately from functional changes.

Earlier features remain documented in the package guides and Git history. No historical
release dates, tags or release claims have been fabricated for this changelog.
