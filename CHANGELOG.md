# Changelog

## Unreleased

- Repository-level installation, testing and production-build commands for the editor,
  API and standalone film.
- Active CI, coverage baselines, dependency auditing, secret scanning and reviewed update configuration.
- Development/test setup documentation and separate disposable database configuration.
- Structured diagnostics with safe error context and optional bounded self-hosted OTLP export.
- One `api/src/logging.ts` entry point for the JSON logger, with request correlation, level
  escalation and error classification now covered end to end through the HTTP middleware.
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
