# Verification

Use Bun 1.4.2 and a PostgreSQL 17 database ending in `_test`. The root `test:prepare`
command requires `TEST_DATABASE_URL`, overrides migration `DATABASE_URL` only in the
child process, and never migrates a live development database by fallback.

`bun run verify` runs lint, formatting, types, all three package suites and production web
builds. `bun run test:repository` checks repository tooling. CI additionally runs coverage,
Redis integration, a production API Docker build, dependency audits and secret scanning.

## Coverage scope and gates

`bun run coverage` executes the full tests under each package with Bun's LCOV reporter.
It counts owned production modules imported by those tests, excluding test modules and
cross-package imports from that package's numerator/denominator. API adapter modules are
also owned source. Bun does not automatically instrument every unimported UI file:
these percentages must not be advertised as whole-application coverage.

`coverage/summary.json` publishes line/function coverage, instrumented production-file
counts and source inventory counts. CI uploads that file and the three LCOV reports.
`tools/coverage-baselines.json` contains the initial measured floors. CI fails if line or
function coverage or the instrumented production-file count decreases. The baseline is
rounded down to whole percentage points to avoid failures from sub-point platform differences.
It is
not rewritten by CI. Add behavior tests toward at least 60% and review changes in scope;
never exclude production features simply to improve a percentage.

After a deliberate local review, regenerate baselines with
`bun scripts/coverage.mjs --record-baseline`. A green coverage gate does not replace
browser interaction, graphics, security or external-provider verification.

## Independent checks

Live Gemini and storage checks remain opt-in scripts in `api/README.md`; they can spend
quota or write private objects. Normal CI uses fakes and does not require their credentials.
Film MP4 export is optional local tooling, separate from its web build and timeline tests.
Coverage instrumentation uses a 20-second test deadline; it does not change production
request/AI timeouts. The ordinary backend suite uses the same bounded deadline for its
real database and image-processing integration cases.

The formatting pass expanded formerly dense API files. The file-size guard retains a
200-line limit for new files, prohibits growth in the explicitly recorded formatted legacy
files, and enforces a 500-line hard ceiling. This avoids changing working modules merely
to counter line wrapping; larger legacy files should be extracted when behavior changes.
The native WebGPU tower startup defect remains open and must not be represented as fixed
by passing unit tests or WebGL screenshots.
