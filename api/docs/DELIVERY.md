# Backend delivery report

Status: implemented and locally verified backend foundation, prepared for VPS staging.
This report separates verified local behavior from external deployment gates. Nothing was
committed, pushed or deployed. The user's move of the frontend into `client/` was preserved.

Local handoff: updated API at `http://127.0.0.1:4000`; client dev server at
`http://127.0.0.1:5173`. Development storage/Gemini credentials are not configured, so
readiness advertises those capabilities as disabled. Ordinary editor functionality
continues locally, and API authentication/persistence/realtime can be tested independently.

## 1. Existing client architecture discovered

The React/Vite client uses Zustand for editing/selection and IndexedDB for project/source
storage. Its mature canonical Project contains buildings, levels, straight/curved walls,
hosted doors/windows/passages, rooms, slabs/openings, columns, stairs, ramps, roofs, fences,
architectural details, source calibration and optional furniture. Pure domain functions
maintain dependent geometry; Three rendering and software fallback are separate. Local
OpenCV and PDF rasterization already exist. Inspection was documented before implementation
in [CLIENT_CONTRACTS.md](CLIENT_CONTRACTS.md). No prior account/cloud collaboration model
was assumed or substituted.

## 2. API architecture adopted

All backend files are under `api/`, using Bun, Hono, native Bun.SQL/S3/password/Redis,
Zod, official Google GenAI SDK and sharp. Modular security, persistence, review, worker and
realtime responsibilities are described in [ARCHITECTURE.md](ARCHITECTURE.md). Architectural
types and pure geometry come from the existing client. `api/client` is a browser-safe
transport and stable-ID diff adapter; UI integration remains a separate milestone.

## 3. Database schema

Relational identity/team/membership, review, private asset, share and job records surround
JSONB project snapshots and incremental operations. Authoritative revisions are monotonic.
Checksums survive JSONB key ordering. Immutable versions restore into new revisions.
Approvals record reviewed revision; older approval rows from before that migration retain
NULL because immutable history is not rewritten. Foreign keys, unique indexes, row locks
and immutable-history triggers enforce the important persistence invariants.

## 4. Migration setup

Ten numbered migrations currently cover accounts, documents, storage/jobs, review,
integrity, realtime/AI, operational constraints, approval revisions, immutable operation/
snapshot history and issue context. `bun run migrate` uses an advisory lock, transactions
and stored checksums. All were applied to isolated PostgreSQL 17.6 and re-run safely.
`deploy/runtime-role.sql` separates app privileges from migration privileges. See
[VPS.md](VPS.md) for production TLS, roles, backups and migration commands.

## 5. Endpoint inventory

[ENDPOINTS.md](ENDPOINTS.md) is generated from actual Hono registrations. Protected routes
use `/api/v1`; only `/health` and `/ready` are outside versioning. Domains include sessions,
users, teams/invitations, projects/operations, collaborators, versions/compare/restore,
private assets and source links, analysis/review, comments, issues, approvals, views,
presentations, shares, scoped libraries, quantities, JSON exports and audit history.
Authenticated `/api/v1/openapi.json` uses registered paths and shared Zod schemas. Auxiliary
request/response documentation is not yet exhaustive enough for complete code generation.

## 6. Realtime protocol

Authenticated Origin-checked WebSockets use persistent operations plus transient presence.
Native PostgreSQL LISTEN/NOTIFY carries event IDs; handlers retrieve durable outbox rows.
Two separate API instances were tested. Heartbeats, global user connection leases, message
limits, 30-second entity locks, bounded history resume and authorization rechecks are
implemented. Slow peers are disconnected at a bounded buffer and reload from snapshots.
See [REALTIME.md](REALTIME.md) for messages and reconnect behavior.

## 7. Authentication/security design

Argon2id passwords; high-entropy opaque cookies; hashed session/CSRF/share/invitation tokens;
idle/absolute expiry; logout-all/device revocation; exact-origin CSRF protection; strict
project and team permissions; per-IP/user/action limits; progressive login cooldowns;
correlated redacted errors; private storage and short signed URLs. Team ownership governs
team projects, and removed members lose creator-derived access. Foreign entity anchors,
versions, assets, assignments and source links are rejected. Guest share authors are
identified as guests, never impersonated as the project owner.

## 8. Gemini analysis architecture

Optional consent-based cloud jobs supplement existing local deterministic candidates.
Images are bounded for provider upload; normalized top-left coordinates are explicitly
mapped to canonical metres using source dimensions, calibration and alignment. Bounded
structure/opening, room, optional furniture/fixture and complex-validation passes retain
uncertainty and evidence. Source hashes, model/prompt/schema version, pass caches and
provider usage support provenance and cost tracking. Invalid output never directly edits
the building. User-selected/edited candidates are accepted as a validated canonical
operation against the current revision; reject/cancel remain distinct.

Cancellation blocks late publication but cannot guarantee reversal of provider charges
already incurred. Ordinary tests use fake providers and spend no Gemini quota.

## 9. Environment-variable template

`.env.example` contains configuration for database/TLS/CA, exact origins, sessions, private
S3, optional Gemini/model policies, Redis/PostgreSQL protection, quotas, snapshots, worker
leases, logs and trusted proxies. `.env*`, `.local/`, dependencies and logs are ignored;
only `.env.example` is intended for Git. No actual credentials appear in deployment templates.

## 10. Development commands

See [README.md](../README.md) for install, local database setup, migrations, API and worker
commands. `bun run verify` checks source length, TypeScript and tests. `check:startup`
launches a real temporary API and cleans it up. `check:storage` and `check:ai` are explicit
live-provider checks; the latter requires `LIVE_GEMINI_CONFIRM=yes`.

## 11. Test results

Local PostgreSQL integration exercises authentication/expiry/CSRF, IDOR/roles, atomic
revisions/idempotency, immutable history/restore, actual two-instance WebSockets, uploads
with fake private storage, proposals/acceptance, cancellation/late workers, pass caching,
invitations/team ownership and revoked memberships. Tests also cover all nine canonical
samples, semantic polygon comparison and bounded slow-peer behavior.

Final API run: **38 passed, 1 skipped, 0 failed**, with 183 assertions across nine test files.
The native Redis integration
test is skipped locally because installed Windows Redis 5 is incompatible with Bun's
Redis 7.2+ requirement. The CI template supplies Redis 7; it has not yet been activated.
Frontend regression: **128 tests passed, zero failed**, covering existing domain/editing,
interpretation, stairs, roofs, fences, quantities and sample workflows. No frontend UI
code was changed by this backend task. Automated coverage does not certify every possible
real architectural drawing or every device interaction.

## 12. Typecheck results

API `bun run typecheck` passed. The browser adapter bundles separately to about 4.2 KB
without server dependencies. The existing frontend production build, including its
TypeScript checks, passed. Existing large OpenCV/PDF bundle warnings remain.

## 13. File-length verification

`scripts/check-lines.ts` checks every API source, adapter, script and test TypeScript file
and fails above 200 lines. It reports file count and maximum length in development/CI.
The final check covered **100 TypeScript files**, with a maximum of **102 lines**.
Markdown, SQL and deployment configuration are not compressed to satisfy that source rule.

## 14. Known limitations and deployment gates

- The browser adapter is not wired into login, cloud projects, review or collaboration UI.
  IndexedDB remains authoritative for the existing local application until that integration.
- Live S3 provider behavior/browser CORS, Gemini availability/quality, native Redis 7.2,
  production TLS and Linux systemd/Nginx/Docker deployment still require staging verification.
- Geometry validation enforces shape bounds/references and host fit; it is not an architectural
  code-compliance engine. Legacy passages through low parapets remain compatible with samples.
- Unknown/void geometry and curved opening inference need manual domain edits. Detected stairs
  become guides until target levels/openings are explicitly defined. No floor-plan accuracy
  benchmark or construction-ready interpretation claim is made.
- Analysis acceptance is one review transaction; unselected candidates are not kept as a
  second acceptance round. Large review batches must be divided before requesting/accepting.
- Conflicts require explicit rebase/review; no automatic offline merge or CRDT. Reconnect
  review data uses HTTP refresh, not a separate durable comment-event cursor.
- Account email delivery, password reset and verified-email onboarding were absent from the
  inspected client and are not implemented. Invitation delivery is the caller's responsibility;
  lost initial tokens require revocation and a new invitation, not plaintext recovery.
- Implemented exports are project JSON and quantities JSON. No pretend IFC/glTF/PDF export,
  video rendering or professionally certified BOQ endpoint exists.
- Storage and database publication cannot be one atomic transaction. Monitor failed cleanup
  and reconcile objects after outages. Signed URLs already issued remain usable until expiry.
- Production capacity, slow-network performance and backup recovery require measured staging
  tests. The CI workflow is provided as a template under `api/`, not silently activated.

## 15. Next recommended backend milestone

Integrate accounts and remote projects into the existing UI behind an explicit cloud mode,
with a local pending-operation queue, retry/idempotency, conflict review, cross-tab session
handling and reconnect recovery. Then connect private source upload, proposal review and
collaboration controls. Exercise this end to end on the VPS with real private storage
before enabling public accounts or claiming a fully deployed production platform.
