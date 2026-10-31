# Contributing

Start with the root README and use Bun 1.4.4 with a frozen lockfile. The three runtime packages
are members of one Bun workspace, so a single `bun install --frozen-lockfile` at the repository
root installs all of them; the API and film reuse client geometry, so none may be skipped.

## Changes

- Keep fixes focused and pair behavior changes with meaningful regression tests.
- Preserve model IDs, coordinate units, project permissions, offline behavior and renderer
  ownership. Do not reduce graphics quality to make a performance check pass.
- Use the existing Oxlint configuration. Investigate warnings before changing hook
  dependencies or imperative Three.js code; document narrowly scoped justified exceptions.
- Format with `bun run format`. Keep formatting-only changes separate from functional work.
- Keep new source files at or under 200 lines. `bun run typecheck` also runs the client and API
  file-size guards, which read `tools/client-file-size-baselines.json` and
  `tools/api-file-size-baselines.json`: a listed legacy file may not grow past its recorded count
  and any other file is capped at 200. Work that touches an oversized file should bring it toward
  300 lines or fewer by extracting a real module boundary; changing a baseline is a deliberate,
  reviewed edit, never a way to make a check pass.
- Run `bun run verify`, `bun run coverage` and `bun run audit` with a disposable migrated
  test database, and `bun run check:startup` to boot the real API against that same database.
  Describe graphics or external-service checks that could not be completed.

## Reviews and maintenance

Pull requests should state the issue, changed behavior, tests and remaining risks. Never
include private floor plans, environment files, access tokens, generated videos or test
artifacts. Use your real author identity. Do not manufacture commits, contributors or tags
to influence an external assessment.

Coverage baselines are reviewed configuration. Update them only after examining the
scope and new behavior tests; CI must not regenerate or lower them automatically.
Dependency updates need passing checks, with matching React/Three.js packages reviewed
together. Runtime major upgrades require explicit compatibility verification.
