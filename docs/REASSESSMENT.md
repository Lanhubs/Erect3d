# Assessment remediation evidence

This report maps repository improvements to the supplied 39.1 assessment. A new score or
offer is determined by the external reviewer; neither is guaranteed by these changes.

| Finding                        | Remediation / evidence                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Missing root onboarding        | Root README, contribution/security guides, changelog and configuration examples                |
| No reproducible install        | Bun 1.4.4, one committed workspace lockfile and a single frozen installation command           |
| No active CI                   | `.github/workflows/ci.yml`: lint, format, types, tests, coverage, builds and security          |
| Backend tests difficult to run | Explicit disposable test database, migration command and service health checks                 |
| No lint/format enforcement     | Existing Oxlint extended to packages; separate Prettier normalization and checks               |
| No coverage enforcement        | Measured package baselines, LCOV artifacts and documented instrumentation scope                |
| No dependency maintenance      | Manual-review Renovate configuration and high/critical advisory checks                         |
| Missing logging/error tracking | pino as the JSON emitter behind the existing contract, plus optional Sentry incident reporting |
| No containers                  | Standard root Dockerfile; Compose adds API/worker, PostgreSQL and a separate test DB           |
| Short or single-author history | Genuine future maintenance only; no synthetic history or contributor identities                |

The first scanner also missed files that were present: per-package Bun locks, client Oxlint,
the backend Dockerfile, package documentation and structured logging. The locks were the one
finding that was not a miss: with three per-package lockfiles and none at the root, a scanner
that starts at the repository root found no lock and therefore reported zero direct and zero
transitive dependencies. That is now one root workspace lockfile, and the reading is checked by
`tests/dependency-health.test.ts` rather than asserted here.

## Verification results (recorded 30 October 2026)

The tables in this section are the evidence snapshot for that round; the pass below records
what has been re-measured since.

Verified on Windows with Bun 1.4.2 and an isolated native PostgreSQL 17 cluster. An
independent source copy started without dependencies, build outputs or private environment
files, then installed all four lockfiles with frozen installation. Its migration, lint,
formatting, type checks, complete tests and combined production web build passed.

| Suite                              | Result                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------- |
| Client                             | 247 passed, 0 failed                                                    |
| API                                | 182 passed, 0 failed, 1 optional Redis test skipped locally             |
| Film                               | 2 passed, 0 failed                                                      |
| Repository safety/coverage tooling | 3 passed, 0 failed                                                      |
| Secret scanning                    | Pinned Gitleaks 8.24.3: no leaks in the clean source snapshot           |
| Dependency advisory gate           | No high/critical advisories after targeted Vite/source-map/Sharp fixes  |
| Production web builds              | Editor and independent film passed; existing chunk-size warnings remain |

### Coverage

| Package | Lines  | Functions | Instrumented / inventoried source files |
| ------- | ------ | --------- | --------------------------------------- |
| Client  | 60.22% | 76.83%    | 288 / 375                               |
| API     | 87.11% | 88.39%    | 156 / 161                               |
| Film    | 99.55% | 94.11%    | 4 / 10                                  |

These figures cover owned production modules imported by tests. They are not whole-app
coverage and are not the external assessment score. Committed gates use measured,
rounded-down floors and prohibit reductions in instrumented-file counts. Additional tests
exercise offline creation, source review, locked furniture controls, structural controls,
software-renderer recovery, model framing and walk-map bounds.

### Preserved behavior

- Original-byte ZIP round trips, image dimensions, JPEG orientation and 16-bit PNG
  fidelity tests pass with the targeted Sharp security update.
- Formatting review compared emitted syntax before/after. Geometry, materials, shaders
  and renderer logic remain unchanged; JSX whitespace differences match the formatter's
  output. Functional changes are confined to diagnostics, verification tooling and the
  production-preview proxy correction.
- The isolated production editor successfully loaded the backend catalogue, opened a
  house template, created a separate centimetre-unit project, saved/reopened projects,
  searched/sorted the library and loaded private plan previews.
- Desktop/tablet/phone checks retained Assistant, collaboration, presentation, furniture
  and all drawing controls. The house retained one canvas and the same preparation
  marker through presentation and phone resizing. No horizontal overflow was observed.
- The built film loads from the original combined-production URL without its development
  server. Manual offline state and conflict/reconnect behavior are covered by automated
  tests; live Gemini/R2 requests were not required or made.

### Evidence and remaining gates

Ignored local evidence is in `.local/reassessment/`: clean installation/verification and
coverage logs, source/format review snapshots, the redacted scanner report and actual
browser screenshots under `screenshots/`. The full formatting pass is reviewable against
the saved `before-format` snapshot and `formatting-only.patch`; the intentional diagnostics/tooling changes are listed
separately in `format-review-final.json`. No commits or history were fabricated.

- Docker Compose configuration validates, but this machine's Docker daemon is stopped.
  Local verification used native PostgreSQL instead. The backend Docker build and full
  Compose runtime remain to be confirmed; CI contains a production-image build step.
- Redis integration is skipped locally; CI provisions Redis 7.4 and enables that test.
- Hosted GitHub checks require publishing these changes. A hosted green run has not been
  claimed. Renovate requires owner activation; branch protection remains an owner setting.
- Existing lint warnings remain visible and reviewed in `LINT_REVIEW.md`; they have not
  been globally suppressed or described as zero warnings.
- Browser verification used the explicit Compatibility renderer. The native WebGPU tower
  startup defect remains open; no new navigation-performance claim is made.
- A rescore, offer or funding decision belongs to the external reviewer. The changes
  establish evidence, not a guaranteed score or eligibility.

## Repository improvement pass (31 October 2026)

Each scanner finding was re-checked against the code before anything changed, so a finding the
repository already satisfied was recorded rather than "fixed". The owner's standing instruction for
this pass was that no interface, model or rendering behavior may change; the work is therefore
confined to tooling, module structure behind unchanged components, tests and documentation. Two
changes beyond that were authorized by name: declaring the Tailwind packages the build already
imported, and hardening the file-size guard test.

| Finding                     | Independent check                                                                                                | Outcome                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No runnable test suite      | `bun run test` executed with no database configured                                                              | Runnable, and it names the 28 database suites it skips instead of hiding them                                                                                       |
| Not reproducible install    | Read `scripts/repository.mjs` and each manifest/lock, then cloned the repository and ran the documented workflow | Frozen per-package installs reproduced in a clean clone; that clone's first production build exposed an undeclared dependency, since declared and re-verified below |
| No structured logging       | Existing shared JSON logger found; no dependency added                                                           | Consolidated behind one `api/src/logging.ts` entry point with HTTP-level coverage                                                                                   |
| Oversized frontend files    | Measured the five largest editor modules, split each at a real boundary                                          | See sizes below; the largest remaining files are deliberately untouched                                                                                             |
| Weak test coverage evidence | Ran the database-free suites; coverage requires the disposable database                                          | 543 tests pass; coverage floors restated from committed configuration, not re-measured                                                                              |
| CI/security immaturity      | Read `.github/workflows/ci.yml` and `.gitleaks.toml`; ran lint/format/types/audit                                | Steps and gates are real; hosted green run not claimed here                                                                                                         |
| Documentation drift         | Every documented command read against its script, then corrected                                                 | Defects listed below; `api/docs/ENDPOINTS.md` regenerated from the live route tree                                                                                  |
| Repository history maturity | Inspected `git log` authors and dates; no tags                                                                   | No history rewritten, no contributors or releases invented                                                                                                          |

### Sizes after the module splits

| Module                                             | Before | After |
| -------------------------------------------------- | ------ | ----- |
| `client/src/rendering/Viewer.tsx`                  | 533    | 187   |
| `client/src/app/Workspace.tsx`                     | 705    | 254   |
| `client/src/features/inspector/Inspector.tsx`      | 604    | 145   |
| `client/src/features/structure/StructurePanel.tsx` | 569    | 75    |
| `client/src/cloud/ProposalReview.tsx`              | 512    | 271   |

Each split was proved behavior-identical by rendering the pre-change component beside the
refactored one in a browser and comparing the normalized DOM through the same interaction
sequence, alongside the package suites, type checks and lint baseline.

### Measured in this pass

| Command                             | Result                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bun run lint`                      | 150 warnings, 0 errors across 874 files — the recorded baseline, not reduced by suppressions                                                                             |
| `bun run format:check`              | 960 files checked, 0 needing formatting                                                                                                                                  |
| `bun run test` (no database)        | 543 pass, 0 fail: 16 repository tooling, 321 client, 204 API, 2 film; 28 integration suites listed as skipped                                                            |
| `bun run typecheck`                 | Client, API and film type checks plus both size guards: API 323 files maximum 378, client 448 files maximum 488                                                          |
| `bun run build`                     | Editor and standalone film production builds passed here, retaining the existing large-chunk warnings; the clean clone below now emits the same stylesheet byte for byte |
| `bun run audit`                     | No high or critical advisories (21 root, 66 client, 103 API, 90 film packages)                                                                                           |
| `bun scripts/endpoint-inventory.ts` | Regenerates the endpoint inventory deterministically; 94 registered endpoints                                                                                            |

### Fresh-clone reproducibility run

The 30 October table above claims a fresh independent copy built successfully. That copy was made
on this machine, where a module installed outside the repository can satisfy an import; a clone in
a different directory does not have that accident. This pass cloned the repository to an unrelated
path, with no `node_modules`, and ran the documented workflow. That table is the first run; the
clone has since been remade from the committed history and passes, as recorded after the defects:

| Step                                                               | Result                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `bun install --frozen-lockfile` (root)                             | Passed                                                                     |
| `bun run setup` (client, API, film from their own committed locks) | Passed                                                                     |
| `bun run lint`                                                     | 150 warnings, 0 errors — identical to the working tree                     |
| `bun run typecheck`                                                | Passed, including both file-size guards with the same maxima               |
| `bun run test`                                                     | 543 pass, 0 fail; the cold first run failed the guard case, recorded below |
| `bun run build`                                                    | **Failed**: `Unable to resolve @import "tailwindcss"`                      |

Two defects followed:

1. **Undeclared build dependency.** `client/src/index.css` starts with `@import 'tailwindcss';`
   and no manifest declared Tailwind, so the stylesheet resolved only where a copy existed somewhere
   Node's parent-directory search could reach; this developer's stray `tailwindcss@4.3.3` in
   `~/node_modules` is why local builds succeeded and a clean machine's did not.
2. **Cold-start flake in the guard test.** The last case of `tests/cad-file-size.test.ts` spawned
   two `bun run check:lines` children inside Bun's default five-second test budget. On the cold
   clone it exceeded it and failed; re-running the identical command in the same clone passed with
   the rest of the suite.

Both are now closed on the owner's instruction. `tailwindcss` and `@tailwindcss/vite` at `4.3.3`
are client devDependencies and `client/vite.config.ts` registers the plugin, and the guard case
runs each script as its own process inside an explicit 120-second budget. The clone was then made
again from the committed history and the documented workflow re-run end to end:

| Step                                             | Result                                                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile`, `bun run setup` | Passed; both Tailwind packages land in the clone's own `client/node_modules`, and no parent directory of the clone has one |
| `bun run lint`                                   | 150 warnings, 0 errors                                                                                                     |
| `bun run format:check`                           | 960 files, 0 needing formatting                                                                                            |
| `bun run typecheck`                              | Passed; API guard 323 files maximum 378, client guard 448 files maximum 488                                                |
| `bun run test`                                   | 543 pass, 0 fail, 28 integration suites skipped                                                                            |
| the guard case on its own                        | 2536 ms cold — well inside the budget it now carries                                                                       |
| `bun run build`                                  | Passed: `client/dist/assets/index-CcQfal0q.css`, 93,028 bytes, sha256 `1f46409f…82b6`, identical to this tree's output     |

**An open defect comes from the plugin rather than from the declaration.** Building the same tree
with `tailwindcss()` removed yields `index-BvQRVDl5.css`, 104,988 bytes, sha256 `57de0063…ee09`.
The two outputs differ in kind, not only in size:

| Built editor stylesheet | remote `@import` | `@font-face` or font bytes | `@property` | unresolved Tailwind at-rules |
| ----------------------- | ---------------- | -------------------------- | ----------- | ---------------------------- |
| plugin off              | 1 (Google Fonts) | 0                          | 0           | `@tailwind` 1, `@theme` 2    |
| plugin on               | 0                | 0                          | 34          | 0                            |

Tailwind compiles its own at-rules away, and the remote font `@import` that sits on the second line
of `client/src/index.css` disappears from the output instead of being hoisted, with nothing inlined
in its place. The stylesheet still names `'DM Sans'` 15 times and `'IBM Plex Mono'` 31 times, so
that text now depends on whatever the platform supplies. In one page, swapping only the stylesheet,
`document.fonts` registered 23 faces against the old output and 0 against the new one, and returned
to 23 when swapped back. On the animated landing route 88 of 345 elements measured a different box
between the two sheets (the primary button 163.66 → 172.98 px wide, the page 8300.86 → 8289.86 px
tall) while every computed `font-*` property stayed identical; that route also moves on its own, so
those numbers are indicative. The deterministic part is the stylesheet itself: the request for the
two families exists in one build and not the other. Declaring the dependencies is rendering-neutral,
which is what the identical hashes above show; enabling the plugin is not. The usual remedy is a
`<link rel="stylesheet">` for those families in `client/index.html`, and it is left to the owner
because it decides how the application paints.

### Not verified here, and why

_The first two bullets are this round's snapshot and have since been overtaken: the database
suites, the Redis suite, `check:startup` and `bun run coverage` were all executed afterwards
against disposable containers, with the results recorded in
"The database suites were then actually run"._

- `bun run test:prepare`, `bun run test:integration`, `bun run coverage`, `bun run check:startup`
  and the full `bun run verify` need a disposable PostgreSQL 17 ending in `_test`. This machine's
  Docker daemon is stopped, and the PostgreSQL listening on `127.0.0.1:5432` is the developer's
  live instance, which repository policy forbids using for tests. The 28 API integration suites,
  the Redis suite and the coverage gates therefore were not executed locally in this pass; CI runs
  all of them against provisioned services.
- The committed coverage floors remain `client 60/76/288`, `api 87/88/156` and
  `motion-video 99/94/4` (line percent, function percent, instrumented files). The 30 October
  table above records the run that measured them.
- `docker build -t erect3d-api .` and `docker compose up` were not run (no Docker daemon). The
  committed `Dockerfile`/`compose.yml` and CI's production-image build step are the evidence
  available from this machine.
- `check:ai` and `check:storage` were not run: no Gemini or R2 credentials exist in this
  environment, and both spend quota or write private objects.
- Graphics evidence is limited. Browser comparison covered DOM, controls and interaction; WebGL
  never initialised in the in-app browser, so nothing rendered inside `<Canvas>` was visually
  confirmed, and the native WebGPU tower startup defect stays open.

### Deliberately left alone

- `client/src/app/Workspace.tsx` keeps 254 lines with a frozen baseline entry. Further splitting
  the application shell would create modules that only exist to satisfy a counter.
- Eleven client and three API legacy files remain above 300 lines, the largest being
  `client/src/cloud/SourcePanel.tsx` at 488. They are frozen at recorded counts and were not
  refactored, because the owner rejected interface-affecting changes mid-pass.
- A proposed SourcePanel split was reverted at the owner's instruction. Its unverified scaffolding
  sits outside the repository at `C:/tmp/wp5-scaffold/sourcepanel-inprogress/` and must not be
  applied without an explicit go-ahead.

### Documentation defects found and corrected

- `docs/VERIFICATION.md` claimed the size guard "enforces a 500-line hard ceiling". The guards
  enforce per-file limits (200 by default, frozen baselines) and only report the maximum they saw;
  300 lines is a reviewed convention, not a code limit.
- `bun run check:startup` existed and ran in CI but was documented nowhere; the root README and
  `docs/VERIFICATION.md` now describe it, including that it refuses to run without the disposable
  database.
- The README pointed readers at `http://127.0.0.1:5173`, but the client dev server binds Vite's
  default `localhost`, which is IPv6-only on some Windows setups.
- `api/docs/ENDPOINTS.md` had been edited by hand and no longer matched the route tree; it was
  missing assistant, plan-preview, member and archive-token routes. Its generator also produced a
  different list depending on which storage backend the operator had configured, so it now
  registers both and the file is regenerated output.
- The collaborator-by-email notes moved into `api/docs/ARCHITECTURE.md` after being re-verified
  against `api/src/modules/collaboration/membership.ts`.
- `api/docs/DELIVERY.md` and `client/ARCHITECTURE.md` still described the pre-baseline rule
  ("fails above 200 lines", "every source file must stay under 200 lines"); both now state what
  the guard actually does, and `api/docs/BACKEND_RECONSTRUCTION.md` marks its file-count figures as
  that run's snapshot.
- `api/docs/VPS.md` referenced `deploy/...` templates relative to `api/` while the rest of the
  document uses repository-root paths; they now read `api/deploy/...`.
- `api/README.md` closed with "Nothing has been committed, pushed or deployed by this backend
  task", which described an earlier working session rather than the repository. It now states what
  genuinely is not provisioned.

## Dependency health and incident reporting pass (1 November 2026)

A later read reported Dependency Health 28/100 with `lockfiles_found` empty, `direct_runtime_deps`
0 and `total_transitive_deps` 0, and Architecture & Robustness 68/100 with `logging_framework` and
`error_tracking` null. Each was re-checked against the repository before anything was added.

| Finding                             | Measured, then changed                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No lockfile, no dependencies seen   | Three lockfiles existed but none at the root, and Bun's workspace layout keeps every transitive package out of a member's own directory tree. Root `bun.lock` now describes all four workspace members: 297 package names, 173 installs, 296 packages resolved, no name resolving twice.                                                                                                                |
| `logging_framework: null`           | The repository's own JSON logger was real but hand-rolled. pino 10.4.0 is now the emitter inside `api/src/logging.ts`, configured to keep the exact line contract (`level`, `at`, fields, `event`; text levels; no `pid`/`hostname`) and the existing redaction, so all 19 call sites and the pre-existing observability assertions were untouched. The last `console.*` in API runtime source is gone. |
| `error_tracking: null`              | `@sentry/bun` + `@sentry/hono` 11.10.0, initialised only in the API and worker entrypoints and only when `SENTRY_DSN` is set (`docs/OBSERVABILITY.md`). `Zod` contracts, `ApiError`, `ProviderFailure`, `app.onError`, `/health` and `/ready` are unchanged.                                                                                                                                            |
| Renovate could not see dependencies | `renovate.json` needed no change: it was already configured for the Bun lockfile manager. With the lock at the root, the manager now finds it.                                                                                                                                                                                                                                                          |

### Evidence for the two new claims

- **Structured JSON**: `api/tests/observability.test.ts` asserts one framed document per event, and
  the HTTP suites still assert their pre-existing contract. A line emitted during this pass reads
  `{"level":"info","at":"2026-10-31T22:32:55.889Z","requestId":"…","method":"GET","status":200,"elapsedMs":12,"event":"http.request"}`.
- **A controlled exception is really captured**: `api/tests/sentry-probe.ts` boots `Sentry.init` in
  its own process against a loopback ingest endpoint, so the SDK's own transport serialized and
  POSTed genuine envelopes; `api/tests/sentry-reporting.test.ts` reads them. Two incidents arrived:
  the unexpected 500 (`TypeError`) and one job failure (`AI_UPSTREAM`, with its `erect3d` context).
  Nothing arrived for the validation rejection, the 404, the unique-constraint violation, the
  provider quota failure or the unconfigured cloud AI. The connection string thrown in the message
  survived as `[REDACTED URL]`, no envelope contained the session cookie, and every response was
  byte-identical with reporting on and off.
- **That run found a real leak**: Sentry 11 attaches the source lines around a throw, so a
  credential written anywhere near the failing line leaves the process. `dataCollection`
  `frameContextLines: 0` now turns that off and every remaining string under `exception` is
  re-scrubbed. The same read showed `sendDefaultPii` no longer exists in Sentry 11: an option set to
  `false` would have been a claim, not a control, so the fields are now switched off individually.

### Measured on 1 November 2026 (Bun 1.4.4, from a clean `node_modules`)

| Command                         | Result                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile` | `Checked 173 installs across 296 packages (no changes)`, from a removed `node_modules`      |
| `bun run lint`                  | 150 warnings, 0 errors, 879 files — unchanged baseline, 5 files added                       |
| `bun run format:check`          | 966 files checked, 0 need formatting                                                        |
| `bun run typecheck`             | Three packages clean; API guard 328 files, client guard 448 files, both within their limits |
| `bun run test`                  | 558 passed, 0 failed (repository 23, client 321, API 212, film 2)                           |
| `bun run build`                 | Editor and film bundles produced                                                            |
| `bun run audit`                 | No vulnerabilities at `--audit-level=high`; see the moderate pair below                     |

The committed lock is the pin, not a scratch artifact: deleting it and reinstalling from the
manifests alone shifted four floating ranges to newer patches (`@babel/runtime`, `postcss`,
`its-fine` and `@google/genai` install-script metadata) and added `libc` qualifiers to the Linux
binary variants. That is exactly why the file is committed and why CI installs with
`--frozen-lockfile`; the committed lock was then re-verified as a fixed point of frozen install.

Two moderate advisories (`glob@13.0.6`, `minimatch@10.2.6`) arrive only through
`@sentry/bundler-plugins`, which the API never imports; their fixes (glob ≥14.0.2, minimatch
≥11.0.1) are outside the ranges Sentry declares, so no in-range upgrade exists and forcing one
would be a fabricated green check. Two consequences are worth stating: the workspace lock requires
Bun 1.4.4 because 1.4.2 writes a phantom root dependency into it, and the repository now asserts
that pin, so a developer still on 1.4.2 will see `bun run test` fail until they upgrade.

## The database suites were then actually run (1 November 2026)

The previous paragraph was written when starting a container had been declined. That declined
constraint is what let a real defect survive three rounds of "full" verification, so the suites
were run for their own sake rather than to complete a checklist.

Two disposable containers, both loopback-only, neither holding a repository secret: `postgres:17`
published on `127.0.0.1:55432` with its data directory on `--tmpfs` so nothing persists, and
`redis:7-alpine` on `127.0.0.1:56379` started with `--save '' --appendonly no`. `erect_api_test`
came from `tools/postgres-init.sql`, and `bun run test:prepare` applied all 12 migrations to it.
The developer's live cluster on `127.0.0.1:5432` was not contacted; every command below ran with an
explicit `TEST_DATABASE_URL`, in a source copy that contains no `.env` file at all, and
`api/tests/helpers.ts` additionally refuses any database name not ending in `_test`.

| Command                                       | Result                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile`               | resolved from the committed lock, `pino 10.4.0` and `@sentry/* 11.10.0` installed exactly as pinned |
| `bun run test:prepare`                        | migrations `001_accounts` … `012_cad_sources` applied to `erect_api_test`                           |
| `bun run test:integration`                    | 92 passed, 0 failed, 1 skipped — 93 tests across 28 files, 54.4s                                    |
| `tests/redis.integration.test.ts`             | passes once `TEST_REDIS_URL` is set (run separately: 1 passed, 0 failed)                            |
| `bun run check:startup`                       | "Real API startup, readiness, health and authentication boundary passed"                            |
| `bun run test` (with the database)            | 651 tests — 650 passed, 1 skipped, 0 failed (repository 23, client 321, API 305, film 2)            |
| `bun run test:integration` after the fix      | 93 passed, 0 failed, 0 skipped across 28 files with both URLs set — this is the committed tree      |
| `bun run lint` / `format:check` / `typecheck` | 150 warnings 0 errors on 879 files / 966 files, 0 need formatting / three packages clean            |

### The defect the database suites caught

`api/tests/jobs.integration.test.ts:85` captures worker output with `spyOn(console, 'log')`. The
pino commit had also moved the default sink from `console.log(line)` to
`process.stdout.write(\`${line}\n\`)`, so that spy saw nothing, `find`returned`undefined`and
"a failing provider job logs safe request, project and failure identifiers" failed with "received
value must be a non-null object". The suite was right and the implementation was wrong: the sink
change was not required by pino and silently moved an observable boundary the tests depended on.`api/src/logging.ts`now defaults to`console.log(line)` again, which is what the pre-pino code
did, and the whole suite passes. Nothing in the assertions was adjusted, and no test was skipped to
obtain that result.

This is the cost of running the unit half alone: `bun run test` without a database reports the 28
skipped files by name, which is honest, but it cannot exercise them, and this regression was in
one of them.

### Coverage gates: red on the first run, and the reason was my own commit

`bun run coverage` had never been executed on this machine. It failed its own floor check, and my
first explanation for that was wrong, so both the error and the correction are recorded here.

| Package        | Measured (line / function / files) | Floor then    | Result       |
| -------------- | ---------------------------------- | ------------- | ------------ |
| `client`       | 60.47 / 75.92 / 339                | 60 / 76 / 288 | floor missed |
| `api`          | 86.48 / 87.54 / 218                | 87 / 88 / 156 | both missed  |
| `motion-video` | 84.16 / 96.87 / 4                  | 99 / 94 / 4   | line missed  |

I first wrote that the gap predated this work, reasoning from the fact that `client/src`,
`client/tests` and the film source are byte-identical to the preceding commit. That inference was
invalid: a coverage percentage is a property of the instrument as much as of the code. The push
settled it — CI was green at `957cc36` and red at `ea77989` on exactly this metric, reporting
`client coverage regressed: functionPercent`.

The actual cause is the toolchain bump my own consolidation commit made mandatory. Bun 1.4.2 and
1.4.4 instrument different totals; measured twice on the same tree with the same 321 passing
tests and only the Bun binary changed:

| Bun   | files | lines / covered | functions / covered | line % | function % |
| ----- | ----- | --------------- | ------------------- | ------ | ---------- |
| 1.4.2 | 339   | 27001 / 16500   | 2419 / 1843         | 61.10  | 76.18      |
| 1.4.4 | 339   | 25595 / 15478   | 2380 / 1807         | 60.47  | 75.92      |

The 1.4.2 row reproduces the numbers in CI's own uploaded table (61.1 / 76.18 / 2419 / 1843), so
this is not Windows against Linux either. One release counts 1406 more lines and 39 more functions
in the same files. The floors in `tools/coverage-baselines.json` had been recorded under 1.4.2,
and the workspace lock requires 1.4.4, so every floor became unreachable without a single line of
behavior changing — `motion-video` by 14.8 points, which no realistic amount of testing could
recover from a 221-line instrumented scope.

Resolved by keying the floors to the Bun release that measured them, rather than lowering a
number to make a run pass. `scripts/coverage.mjs` now reads and writes
`tools/coverage-baselines.json[version]` using `Bun.version`, keeps the original 1.4.2 floors
untouched, records a separate 1.4.4 set from a genuine run against the disposable database
(`client 60/75/339`, `api 86/87/218`, `motion-video 84/96/4`), stamps the measured release into
`coverage/summary.json`, and refuses with an explicit message when the running release has no
floors at all instead of silently comparing across instruments. `tests/coverage.test.ts` guards
the shape and requires a key for the `packageManager` release, so a future bump fails locally with
"record this release" rather than as a mysterious CI red run. No threshold was relaxed: a drop
under the 1.4.4 floors still stops CI, and `--record-baseline` still refuses to run in CI.

The wider lesson is the same one the log-sink defect taught: a green local gate that has never
been executed against the toolchain CI actually uses is not evidence, and a byte-identical source
tree does not make a measurement comparable.

No tag, release, deployment or resubmission was performed in this pass. The work was pushed to
`master` at the owner's request, which is what exposed the toolchain-vs-floor defect above.
A rescore or funding decision belongs to the external reviewer.
