# Contributing

Start with the root README and use Bun 1.4.2 with frozen lockfiles. Keep runtime packages
independent and install all three because the API and film reuse client geometry.

## Changes

- Keep fixes focused and pair behavior changes with meaningful regression tests.
- Preserve model IDs, coordinate units, project permissions, offline behavior and renderer
  ownership. Do not reduce graphics quality to make a performance check pass.
- Use the existing Oxlint configuration. Investigate warnings before changing hook
  dependencies or imperative Three.js code; document narrowly scoped justified exceptions.
- Format with `bun run format`. Keep formatting-only changes separate from functional work.
- Run `bun run verify`, `bun run coverage` and `bun run audit` with a disposable migrated
  test database. Describe graphics or external-service checks that could not be completed.

## Reviews and maintenance

Pull requests should state the issue, changed behavior, tests and remaining risks. Never
include private floor plans, environment files, access tokens, generated videos or test
artifacts. Use your real author identity. Do not manufacture commits, contributors or tags
to influence an external assessment.

Coverage baselines are reviewed configuration. Update them only after examining the
scope and new behavior tests; CI must not regenerate or lower them automatically.
Dependency updates need passing checks, with matching React/Three.js packages reviewed
together. Runtime major upgrades require explicit compatibility verification.
