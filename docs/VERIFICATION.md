# Verification

Use Bun 1.4.4 and a PostgreSQL 17 database ending in `_test`. Install with one
`bun install --frozen-lockfile` at the repository root; the three runtime packages are
workspace members sharing that single committed lockfile. The root `test:prepare`
command requires `TEST_DATABASE_URL`, overrides migration `DATABASE_URL` only in the
child process, and never migrates a live development database by fallback.

`bun run verify` runs lint, formatting, types, all three package suites and production web
builds. `bun run test:repository` checks repository tooling. `bun run test` runs the package
suites: with a disposable `TEST_DATABASE_URL` it runs everything, and without one it runs only
the suites that need no database and prints the name of every `*.integration.test.ts` file it
skipped, so a fresh clone has a runnable command that cannot pretend to be the full suite.
`bun run test:unit` and `bun run test:integration` request either half explicitly, and
`test:integration` refuses to start without the isolated database. `bun run check:startup` also
requires that database: it overrides `DATABASE_URL` with `TEST_DATABASE_URL` in the child process,
boots the real API on loopback port 44001 and checks `/ready`, `/health` and that an
unauthenticated `GET /api/v1/projects` is rejected with 401. CI additionally runs coverage,
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

## Logging and incident reporting checks

`api/tests/observability.test.ts` and `api/tests/observability-http.test.ts` assert the JSON line
contract (one document per event, `level`/`at`/`event`, request id correlation, level escalation)
and the redaction of credentials, URLs and bearer tokens. They need no database and no logger
dependency beyond pino.

`api/tests/monitoring.test.ts` asserts the reporting policy and option mapping, including that an
empty `SENTRY_DSN` leaves the Hono application with exactly one route attached, and rejects the five
malformed DSN shapes. `api/tests/sentry-reporting.test.ts` proves the capture path without any
account: it spawns `api/tests/sentry-probe.ts`, which binds an ingest endpoint on an ephemeral
loopback port, points the SDK at it with a synthetic key, throws a controlled exception and reads
the envelopes the SDK serialized itself. The probe drives the same routes with reporting on and off
and deep-compares every response, so a change in the client-visible error contract fails this suite.
Both files pass with `SENTRY_DSN` unset, produce no traffic beyond `127.0.0.1` and commit no
credential — the DSN, cookie value and connection string in them are placeholders.

The 28 integration suites, `bun run coverage` and `bun run check:startup` need the disposable
PostgreSQL database; nothing above substitutes for them. They have been executed locally against
two loopback-only containers (`postgres:17` with its data directory on a tmpfs, `redis:7-alpine`
with persistence off) and all 28 pass, with the Redis suite passing once `TEST_REDIS_URL` is set —
see [assessment evidence](REASSESSMENT.md). Running them found and fixed a real regression in the
worker log sink, so a unit-only pass is not sufficient evidence for a logging change.

Coverage floors are a separate matter: executed against that database, all three packages currently
miss at least one committed floor, and the same run repeated at the preceding commit shows the gap
predates the dependency and incident-reporting work. The floors were left untouched rather than
re-recorded to match. `bun run coverage` therefore exits non-zero today.

A reproducibility defect found in this pass is closed. The editor stylesheet imports Tailwind CSS,
which no package manifest declared, so a production build on a clean machine failed to resolve that
import even though every test and type check passed. `tailwindcss` and `@tailwindcss/vite` are now
client devDependencies and `client/vite.config.ts` registers the plugin; a clone in an unrelated
path, installed from the committed lockfile with `--frozen-lockfile`, now completes the documented
workflow and emits a stylesheet byte for byte identical to this tree's.

One open defect replaces it, recorded in [assessment evidence](REASSESSMENT.md). With the plugin
enabled the built editor stylesheet contains no `@import` at all, and no `@font-face` or font binary
is inlined in its place, so the built stylesheet never requests DM Sans or IBM Plex Mono while still
naming those families 46 times. Text silently falls back to the platform sans-serif,
which is a visible typography change across the application. Serving the fonts from a `<link>` in
`client/index.html` is the usual remedy, and it is left to the repository owner because it changes
rendering.

The formatting pass expanded formerly dense API files, so size is guarded rather than freely
rewritten. `client/scripts/check-lines.ts` and `api/scripts/check-lines.ts` run inside
`bun run typecheck`. Each source file is compared with a limit from
`tools/client-file-size-baselines.json` or `tools/api-file-size-baselines.json`: a listed file may
not grow past its recorded line count, and a file that is not listed is limited to 200 lines. The
guards report the largest file they saw instead of enforcing an absolute ceiling. 300 lines is the
reviewed target for work that touches an oversized legacy file, so such work should shrink the
file, and any deliberate exception is a baseline edit that a reviewer sees in the diff. This
avoids changing working modules merely to counter line wrapping; larger legacy files should be
extracted when behavior changes.
The native WebGPU tower startup defect remains open and must not be represented as fixed
by passing unit tests or WebGL screenshots.
