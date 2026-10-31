# Assessment remediation evidence

This report maps repository improvements to the supplied 39.1 assessment. A new score or
offer is determined by the external reviewer; neither is guaranteed by these changes.

| Finding                        | Remediation / evidence                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| Missing root onboarding        | Root README, contribution/security guides, changelog and configuration examples       |
| No reproducible install        | Bun 1.4.2, independent committed locks and frozen installation commands               |
| No active CI                   | `.github/workflows/ci.yml`: lint, format, types, tests, coverage, builds and security |
| Backend tests difficult to run | Explicit disposable test database, migration command and service health checks        |
| No lint/format enforcement     | Existing Oxlint extended to packages; separate Prettier normalization and checks      |
| No coverage enforcement        | Measured package baselines, LCOV artifacts and documented instrumentation scope       |
| No dependency maintenance      | Manual-review Renovate configuration and high/critical advisory checks                |
| Missing logging/error tracking | Existing logger strengthened; correlated safe failures and optional self-hosted OTLP  |
| No containers                  | Standard root Dockerfile; Compose adds API/worker, PostgreSQL and a separate test DB  |
| Short or single-author history | Genuine future maintenance only; no synthetic history or contributor identities       |

The supplied scanner missed some existing files: API/client Bun locks, client Oxlint,
backend Dockerfile, package documentation and structured logging. This change makes
entry points discoverable and activates checks; it does not replace working features
solely to satisfy detection heuristics.

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
confined to tooling, module structure behind unchanged components, tests and documentation.

| Finding                     | Independent check                                                                 | Outcome                                                                                |
| --------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| No runnable test suite      | `bun run test` executed with no database configured                               | Runnable, and it names the 28 database suites it skips instead of hiding them          |
| Not reproducible install    | Read `scripts/repository.mjs` and each manifest/lock; commands match              | Frozen per-package installs exist; a fresh-clone install was not re-run here           |
| No structured logging       | Existing shared JSON logger found; no dependency added                            | Consolidated behind one `api/src/logging.ts` entry point with HTTP-level coverage      |
| Oversized frontend files    | Measured the five largest editor modules, split each at a real boundary           | See sizes below; the largest remaining files are deliberately untouched                |
| Weak test coverage evidence | Ran the database-free suites; coverage requires the disposable database           | 543 tests pass; coverage floors restated from committed configuration, not re-measured |
| CI/security immaturity      | Read `.github/workflows/ci.yml` and `.gitleaks.toml`; ran lint/format/types/audit | Steps and gates are real; hosted green run not claimed here                            |
| Documentation drift         | Every documented command read against its script, then corrected                  | Defects listed below; `api/docs/ENDPOINTS.md` regenerated from the live route tree     |
| Repository history maturity | Inspected `git log` authors and dates; no tags                                    | No history rewritten, no contributors or releases invented                             |

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

| Command                             | Result                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `bun run lint`                      | 150 warnings, 0 errors across 874 files — the recorded baseline, not reduced by suppressions                    |
| `bun run format:check`              | 960 files checked, 0 needing formatting                                                                         |
| `bun run test` (no database)        | 543 pass, 0 fail: 16 repository tooling, 321 client, 204 API, 2 film; 28 integration suites listed as skipped   |
| `bun run typecheck`                 | Client, API and film type checks plus both size guards: API 323 files maximum 378, client 448 files maximum 488 |
| `bun run build`                     | Editor and standalone film production builds passed, retaining the existing large-chunk warnings                |
| `bun run audit`                     | No high or critical advisories (21 root, 66 client, 103 API, 90 film packages)                                  |
| `bun scripts/endpoint-inventory.ts` | Regenerates the endpoint inventory deterministically; 94 registered endpoints                                   |

### Not verified here, and why

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

No push, tag, release, deployment or resubmission was performed in this pass either.
A rescore, offer or funding decision belongs to the external reviewer.
