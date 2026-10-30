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

## Verification results

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

No push, release, deployment, external account activation or resubmission was performed.
