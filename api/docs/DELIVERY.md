# Backend delivery report

Status: implemented and locally verified backend foundation, prepared for VPS staging.
This report separates verified local behavior from external deployment gates. Nothing was
committed, pushed or deployed. The user's move of the frontend into `client/` was preserved.

Local handoff: updated API at `http://127.0.0.1:4001`; client dev server at
`http://127.0.0.1:5173`, using `ERECT_API_PROXY=http://127.0.0.1:4001` for this session.
Private filesystem storage and server-side Gemini were configured for isolated local QA.
Readiness advertises private assets, cloud analysis and realtime. Production storage is
Cloudflare R2; live R2 and VPS checks remain deployment gates.

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
transport and stable-ID diff adapter; explicit cloud UI integration is implemented.

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

Optional consent-based cloud jobs enhance interpretation using current canonical model
context and OpenCV evidence. Corrections keep entity IDs, check captured field hashes,
and require separate approval to change confirmed properties.
Images are bounded for provider upload; normalized top-left coordinates are explicitly
mapped to canonical metres using source dimensions, calibration and alignment. Bounded
structure/opening, room, optional furniture/fixture and complex-validation passes retain
uncertainty and evidence. Source hashes, model/prompt/schema version, pass caches and
provider usage support provenance and cost tracking. Invalid output never directly edits
the building. User-selected/edited candidates are accepted as a validated canonical
operation against the current revision; reject/cancel remain distinct. A separate optional
completion pass proposes roof alternatives, wall finishes and glazing. Selected changes
can be compared with the original in the existing 3D renderer before acceptance.

Cancellation blocks late publication but cannot guarantee reversal of provider charges
already incurred. Ordinary tests use fake providers and spend no Gemini quota.

## 9. Environment-variable template

`.env.example` contains configuration for database/TLS/CA, exact origins, sessions, private
R2, optional Gemini/model policies, Redis/PostgreSQL protection, quotas, snapshots, worker
leases, logs and trusted proxies. `.env*`, `.local/`, dependencies and logs are ignored;
only placeholder `.env.example` and `.env.r2.example` templates are intended for Git.
Credentials found in the edited template were preserved under ignored `.local/` and removed
from the tracked template. No actual credentials appear in deployment templates.

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

Latest complete API run: **72 passed, 1 skipped, 0 failed**, with 471 assertions across
nineteen test files in a separate test database, including exact image pixels/orientation,
duplicate object avoidance, R2 signing and temporary-object cleanup, binary upload
idempotency, recovered job state, guarded removals and provider schema handling.
The native Redis integration
test is skipped locally because installed Windows Redis 5 is incompatible with Bun's
Redis 7.2+ requirement. The CI template supplies Redis 7; it has not yet been activated.
Frontend regression: **151 tests passed, zero failed**, covering existing domain/editing,
interpretation, stairs, roofs, fences, quantities, sample workflows, cloud recovery and
OpenCV evidence coordinates. Automated coverage does not certify every possible
real architectural drawing or every device interaction.

## 12. Typecheck results

API `bun run typecheck` passed. The browser adapter bundles separately to about 4.2 KB
without server dependencies. The existing frontend production build, including its
TypeScript checks, passed. Existing large OpenCV/PDF bundle warnings remain.

## 13. File-length verification

`scripts/check-lines.ts` checks every API source, adapter, script and test TypeScript file
and fails above 200 lines. It reports file count and maximum length in development/CI.
The latest check covered **130 TypeScript files**, with a maximum of **112 lines**.
Markdown, SQL and deployment configuration are not compressed to satisfy that source rule.

## 14. Known limitations and deployment gates

- Cloud projects have a separate account-scoped IndexedDB draft queue. Local projects retain
  their existing storage. Offline editing works in an authenticated open tab; a fresh offline
  session cannot authenticate. HTTPS and Web Locks are required for cloud editing.
- Live R2 provider behavior/browser CORS, qpdf execution, Gemini accuracy, native Redis 7.2,
  production TLS and Linux systemd/Nginx/Docker deployment still require staging verification.
- Geometry validation enforces shape bounds/references and host fit; it is not an architectural
  code-compliance engine. Legacy passages through low parapets remain compatible with samples.
- Unknown geometry and curved opening inference need manual domain edits. Reviewed voids must
  fit slabs; detected stairs become guides unless an explicit destination passes placement
  validation. No floor-plan accuracy
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

## 15. Cloud UI milestone — implemented locally; VPS verification pending

The existing editor now supports an explicit `/cloud` account/project workspace. It includes
durable frozen operations, idempotent response-loss recovery, explicit conflict review,
cross-tab CSRF/session handling, one editing tab per project, reconnect snapshot recovery,
read-only roles, private source upload, consent-based proposal review, collaborators,
presence, temporary entity reservations and anchored comments. Cloud copies and local copies
are explicit actions; uploading a local project does not silently upload its images.

Local browser testing exercised sign-in, cloud opening, roof editing, persisted reload,
comments and resolution, source import, optimized upload and OpenCV evidence measurement.
A generated synthetic 700 × 500 plan ran through the real four-pass Gemini workflow.
The browser compared current/proposed 3D and accepted one wall correction, three windows
and one hip roof design; ordinary undo/redo restored both states. The uncompressed test PNG
was reduced from 1,370.0 KiB to 5.7 KiB with original dimensions and exact pixels retained.
This synthetic result verifies integration, not accuracy on complex client drawings.
Production registration defaults closed. The user supplies VPS/R2 configuration later;
live R2 CORS, production capacity and deployed recovery remain staging gates. Nothing was pushed.

## 16. Hybrid interpretation continuation

The browser supplies measured OpenCV wall/opening/detail/thin-line evidence to the provider.
Versioned global, structure, opening, space/circulation, optional detail and warning-only
consistency passes retain review and uncertainty. A selected region produces an actual detail
crop alongside full-plan context. Calibration origin/alignment match the existing editor.
Duplicate wall aliases retain opening hosts; implausible scale/arc evidence loses confidence.
Interpretation preserves chosen roofs; separately selected design suggestions update them
using normal domain controls. Acceptance supports one ordinary undo/redo action.
Exact existing false elements can be proposed for explicit removal, with source evidence,
confirmed-field approval, stale-target checks and hosted-opening protection. Removals start
unchecked. Polling and acceptance no longer spend the Gemini generation request allowance.

Latest isolated checks: API 72 passed / 1 Redis skip / 0 failed; client 151 passed / 0 failed.
API typecheck, 200-line source gate and frontend production build passed.

See [HYBRID_INTERPRETATION.md](HYBRID_INTERPRETATION.md) for the implemented scope, remaining
advanced interpretation work and the live benchmark gate. No measured accuracy improvement
is claimed from fake-provider tests.

## 17. Cloudflare R2 and file size

The browser now uploads binary source bytes through authenticated optimized ingestion.
PNG is losslessly recompressed; JPEG image data and orientation are retained while comments
and non-rendering metadata are removed; PDF stream/object compression uses optional qpdf.
Only a smaller output replaces the input. Upright source images are reused for analysis,
derived PNGs use high lossless compression and thumbnails use bounded WebP. Legacy signed
upload finalization also compacts final objects; its temporary staging copy still exists
until cleanup. Current browser ingestion writes only one compact final object.

See [R2_STORAGE.md](R2_STORAGE.md) for private bucket setup, CORS, limits, Linux qpdf and
staging checks. The configured R2 endpoint returned 403 AccessDenied on signed PUT;
bucket-scoped credentials need correction before live GET/CORS/cleanup verification.
No fixed savings percentage or successful live R2 verification is claimed.

## 18. Backend source interpretation and canonical 3D

Backend AI is the default cloud interpretation engine. Local imports offer a separate
authenticated backend copy and an explicit local-analysis alternative. Cloud imports no
longer auto-run browser reconstruction. Direct-source requests ignore browser candidates,
include original PDF context and server detail crops, and add an AI model repair stage.
Automatic scale can use annotated dimension evidence without point selection.

The server compiles selected geometry for both 3D preview and acceptance. Explicit floor
replacement retains other floors and chosen/manual roofing, uses stable entity IDs and
supports normal editor history. Invalid hosts, polygons or source-footprint violations
prevent a misleading preview. Unsupported automatic roofs are suppressed on unbuilt
imported floors, while manual canopies and room-designed upper floors remain supported.

See [BACKEND_RECONSTRUCTION.md](BACKEND_RECONSTRUCTION.md) for limits, native PDF handling,
source fidelity and deployment requirements. Passing model validation does not establish
perfect architectural interpretation or recover missing elevations from unannotated plans.

## 19. Unified Projects workspace and backend templates

The application uses one Projects dashboard and editor. The backend supplies all nine
samples through its template catalogue and creates private template instances. IndexedDB
stores only working projects, source blobs and pending operations for offline continuity.
Existing device drafts remain recoverable; older routes stay compatible aliases.

Production app-shell caching supports disconnected reloads, and reconnect automatically
replays pending operations and source uploads. Independent edits merge; overlapping edits
retain the draft for conflict review. No session token or private API response enters
the app-shell cache. See [PROJECT_WORKSPACE.md](PROJECT_WORKSPACE.md) for verification
and the retained operation limits. No push or VPS deployment was performed.

## 20. Direct reconstruction and local analysis execution

The reconstruction button now starts a full source-based request directly. Optional
controls remain under Advanced interpretation options. Progress and failures use human
readable messages, empty geometry is a failure, and applying the preview is one explicit
action with Undo. Compiler errors are fed back to Gemini for at most two cached repair
passes; invalid geometry cannot bypass server validation.

Development runs only requested/resumed analysis IDs, with normal database leases and
bounded concurrency. API startup never processes unrelated queued drawings. Production
continues to use its dedicated worker service. The live stadium request was processed
with its existing source-specific consent; no model replacement was performed.

## 21. Source fidelity and protected native geometry (13 October 2026)

Original PNG/JPEG/PDF uploads are stored byte-for-byte, optionally inside a smaller
lossless ZIP. Analysis restores the original; it never uses the thumbnail. Native
image dimensions and fine detail crops are retained. R2 archives use short-lived
private download tickets; legacy unarchived objects remain readable.

Backend OpenCV measures the source before Gemini interprets architectural meaning.
Complex drawings receive regional review and four bounded fine-line classification
passes. Those passes cannot redraw or delete the validated baseline. Unsafe additions
or optional provider failures retain that baseline for review. Duplicate edges of one
wall band collapse; distinct parallel walls with an air gap remain separate.

The supplied 708 × 551 arena PNG was checked against the original SHA-256. Its saved
proposal has 122 wall segments, 15 doors, 21 columns, 14 rooms and four editable tables.
Twelve stair/ramp footprints and eight open circulation routes remain guides. The four
real Gemini fine-line passes confirmed 65 of 400 measured strokes and rejected 335.
This focused run reused the prior real source reconstruction for the other stages;
it is not an independent full rerun or an architectural completeness certificate.

Latest checks: 94 API tests passed, one Redis integration skipped, no failures;
162 client tests passed, no failures with a 15-second suite timeout. API typecheck,
source-length gate and frontend production build passed. See BACKEND_RECONSTRUCTION.md
for browser acceptance evidence and remaining accuracy limits. Equivalent server
refreshes retain Undo/Redo history; actual collaborator changes still reset stale
history. Selecting a pitched roof after an inferred flat roof restores a valid pitch.
No push or VPS deployment.

## 22. Visible direct reconstruction and atomic detailed models (13 October 2026)

One click starts reconstruction with automatic source upload and scale; advanced options
stay collapsed. Workspace progress, elapsed time and Cancel remain visible when project
tools is closed. Authenticated WebSocket events replace repeated connected status polling;
disconnected reads never overlap and terminal states stop reads.

Simple drawings use one coordinated provider pass. Dense drawings use global understanding
and four concurrent native regional reads with unique measurement ownership and scoped IDs.
Direct interpretation has a 60-second provider deadline, one optional source repair and no
automatic retry loop. Failed regions cannot silently become complete buildings. Exact
completed source reads can be recovered after timeouts; provenance records their origin.

Stair source guides and valid fixture corner evidence no longer block otherwise valid
walls unnecessarily. Nearby columns extend the envelope only with source pixel support;
blank margins remain excluded. Independent compiler errors are collected for one repair.
The server and offline sync compact large floor replacement/Undo into atomic entity patches.
The 512-change limit remains, and collaborator locks include overwritten entities. Apply
errors now leave processing state instead of leaving the workspace stuck on “Erecting.”

The supplied original arena PNG was processed without pixel reduction. Recovery used five
completed real regional/global reads and one real 51.9-second repair. The browser applied
120 wall segments, 7 doors, 14 rooms, 13 columns and 11 fixtures, then verified synchronized
Undo/Redo at revisions 11/12. Eight stair/ramp footprints remain guides; scale, missing
windows and architectural completeness remain review concerns. Instant processing and
architect-perfect results have not been achieved. See BACKEND_RECONSTRUCTION.md for the
failed attempts, exact source fidelity and verification details. No push or deployment.

Final verification: 110 API tests passed / one Redis skip / zero failures; 166 client
tests passed / zero failures. API typecheck, source-length gate, production frontend
build and Git whitespace checks passed. Reload retained revision 12 and the isolated
QA account was signed out. The production build still reports its existing large chunks.
