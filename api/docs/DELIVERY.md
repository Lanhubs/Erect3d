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

## 23. Semantic systems, source hosts and multi-plan sheets (15 October 2026)

Architectural systems now retain real source wall identities. Core extensions reuse
authored wall bodies; facade entrances retain real openings. Shared architectural
transforms carry source walls/openings and fitted boundaries. Typical floors reuse
the full template emitters/materials instead of simplified boxes. Current-floor
inspection isolates the selected slice, and compilation errors are visible.

Regional analysis respects a selected floor drawing within a sheet. Whole-source
coordinates are retained throughout measurement, regional ownership, merge and
validation; neighbouring drawings cannot become part of the accepted floor.
Backend users can select a complete floor under advanced options. Ordinary
single-plan reconstruction retains its existing one-button flow.

The supplied fourteen-sheet office PDF exposed a wall reconciliation error: a tiny
native fragment could replace its full host wall. The corrected merger retains
the full span and body thickness, remaps all hosts and preserves separate bands.
Saved real Gemini responses now compile the selected ground-floor drawing with
41 walls, 8 doors and 15 windows. Fine strokes and stair connections still require
review. Original PDF bytes were ZIP-stored and SHA-256 verified unchanged.

A fresh normal authenticated request subsequently completed in 94.0 seconds,
including source upload, live Gemini interpretation and successful server preview.
It produced 29 walls, 8 doors and 15 windows with no geometry errors. It remains
needs-review for fine strokes and stair links; differing provider counts are not
evidence of completeness. The selected floor, not all document storeys, was checked.

The full document is read once globally instead of re-sent with all four regional
requests. Office/public/commercial typologies receive a provisional hidden roof
when no roof was chosen; explicit user roofing is retained. See the client's
RENDERING_VALIDATION.md for exact source/run evidence and outstanding acceptance
gates. This does not certify full multi-storey PDF assembly or reference-image realism.

Final verification: 179 client tests passed, 117 API tests passed, one Redis
integration test skipped. The production client build passed.
Both typechecks, API source-length gate and production client build passed.
No commit, push or deployment.

### 24. Building focus, native region processing and scale correction

New arena/stadium reconstruction and templates are retired; saved projects remain
readable. The normal dense-plan path now uses one coordinated interpretation
instead of five mandatory reads, with a conditional sparse geometry repair.
Native measurements process only the selected drawing at full resolution.
Scale evidence is required for new direct responses; older missing-scale results
infer from source geometry rather than treating page width as building width.
Manual calibration and original file bytes remain protected.

The latest isolated office-PDF run completed in 75.8 seconds with a valid preview,
37 walls, 6 doors, 15 windows and annotated scale. Seven stair connections remain
review items. The earlier 94.0-second result is not an immediate-response target;
provider latency is still material. Local host repairs now omit repeated full-PDF
and design-reference payloads, retaining the native image and relevant crops;
architectural dimension errors still receive document context.

The client removes the fixed 200-floor count ceiling, pages repeated geometry,
fits camera/shadow coverage to height and positions automatic roofs above linked
floors. A synthetic 256-storey fixture validates those mechanisms. Full multi-sheet
assembly and independent architectural fidelity remain acceptance work; no claim
of perfect arbitrary-plan reconstruction or reference-image realism is made.

### 25. Semantic architectural construction and opening depth

Added source-anchored articulation systems and a dedicated architectural-outline
candidate, preserving editable source geometry without fake rooms or extra wall
extrusions. Detected, inferred and optional design-proposal origins are retained;
proposals start hidden. The inspector exposes dimensions, profiles, surfaces,
projection side and explicit repetition with linked floors. Detached floors retain
independent copies. Concave and circular platforms and indexed entrance arches
preserve actual topology.

Window and double-door construction now retains real glazing apertures, frame
depth, mullions/transoms, reveals, sills and curved hosts. Inferred construction
fields are saved separately from source-derived positions and can be reviewed in
the contextual inspector. Manual edits confirm only the changed properties.

Live verification exposed optional-generation fields that permitted orphan
outlines or omitted core heights. Prompt/schema version 31 retains strict semantic
requirements through a shallow provider transport, with required spiral flight
dimensions in a dedicated array and full per-kind canonical validation. Repair
context retains the existing systems and names failed outline IDs. Region limits
remain enforced; the test crop was corrected after visual inspection showed it
cut through the source's external fire escape.

The full client suite passed 198 tests; the final full API suite passed 133 tests
with one optional Redis integration skipped. Both typechecks, the production
build and the API source-line gate pass. Eleven authored building categories exercise the semantic
compiler; these are geometry regressions, not a claim of complete source fidelity.
See client/RENDERING_VALIDATION.md for viewport evidence and outstanding acceptance.

Live checks exposed a spiral fire escape incorrectly represented as a 28-metre
balcony guard and unique ground-floor geometry proposed for repetition. Dedicated
spiral-stair semantics now preserve actual treads, landings, floor/roof holes and
walkthrough surfaces. Guard heights above three metres are rejected. Unverified
AI floor repetition starts hidden until matching layouts are established.

Google rejected the broad per-kind generation grammar. Text-only compatibility
probes accepted the shallow transport; a subsequent exact-PDF response omitted
the spiral's clear flight width and was correctly rejected after 91 seconds.
The dedicated spiral transport now makes that field mandatory. Original PDF
bytes retained their SHA-256 throughout and storage used reversible ZIP only.

Prompt 30 completed the exact selected ground-floor test in 58.2 seconds through
an isolated local store: one interpretation, one source repair, a valid preview
with 21 walls / 7 doors / 6 windows, and `needs-review` quality. This is not a full
multi-sheet building. Visual review exposed missing side glazing. Prompt 31 adds
a dedicated required window array and passes native thin frame/leaf hints into
the compact call; these hints previously never reached that call. A single source
repair also checks absent doors/windows. The detailed strategy already has opening
passes and does not add coverage-only retries. Geometry diagnostics no longer
turn an invalid boundary into a second, misleading missing-boundary error; radius
conflicts include the exact source measurement.

Prompt 31's text-only Gemini compatibility probe passed. Its two live exact-source
attempts ended with a socket failure and Gemini DNS lookup failure, respectively.
The final window-coverage change therefore remains unverified against the live
provider. Separate R2 reads also failed or stalled; bounded signed reads now have
a 30-second timeout, streamed byte limits and `STORAGE_UNAVAILABLE` errors instead
of incorrectly blaming Gemini. The app retains its private R2 configuration.
See client/RENDERING_VALIDATION.md for actual viewport evidence and the remaining
multi-sheet, split-level, source-coverage and performance acceptance work.

### 26. Dense-plan HTTP 400 correction

The reported 507 × 370 PNG produced 481 native wall/edge measurements. Prompt 31
enumerated a JSON-schema property for each group of 25 labels. The full request
was reproducibly rejected with HTTP 400 even with a synthetic blank image;
removing that enumerated map made the same request configuration acceptable.
Prompt 32 uses a constant-size string map. Every group key, exact group length,
allowed label and complete measurement coverage is still checked by the strict
server parser. Geometry and architectural requirements remain unchanged.

Regression checks cover 0, 1, 25, 400, 481 and 2,000 measurements; missing, short,
extra and invalid labels remain rejected. The production request configuration
with 481 measurements was accepted by Gemini after the fix.

The exact reported PNG was matched to its uploaded asset by SHA-256 and tested
through an isolated authenticated local project. It completed one interpretation
and one repair in 53.2 seconds and compiled a valid preview: 55 walls, 4 doors,
4 windows and 16 rooms. Quality is `needs-review` for an interior stair with no
confirmed upper floor. This proves the request failure is corrected; it does not
certify every detected opening or the complete architectural interpretation.
The original PNG remained unchanged and no existing user project was replaced.
Local evidence: `.local/png-analysis-verification.log`.

## 27. Mansion source coverage and recognizable editable furniture

The reported 507 × 370 mansion PNG exposed more than a transport problem.
The previous quality check accepted four doors/windows without examining each
room, and local envelope fitting could turn interior strokes into roof sawteeth.

Changes delivered:

- Validate enclosed-room access, exterior-room glazing, missing depicted fixtures,
  dimension endpoints inside rooms, and polygon interiors as well as vertices.
  Open-plan boundaries remain valid; warnings request source inspection, not
  arbitrary fixture/window counts. Coverage is included in the existing bounded
  repair, and remains visible in the preview.
- Preserve valid source requirements and annotated scale during unrelated repairs.
  Only a matching validation issue authorizes a repaired global reference. Fit
  nearby parallel exterior bands without adding spikes. An explicitly identified
  indoor foyer whose corners already lie within/on the envelope can close a false
  notch; true courtyards and page margins remain excluded.
- Bridge two source wall fragments only when both ends anchor a depicted opening.
  Porch columns can belong to a source canopy outside the thermal envelope.
  Generate one continuous structural slab, retaining voids and room finishes.
- Keep native detail crops for small complex drawings as well as large sheets.
  Source files are never resized or recompressed for these requests. Version 35
  invalidates older interpretation caches.
- Source-anchored vehicle gaps on enclosed garage boundaries support editable
  sectional doors and overhead panel travel. Operation/height and any reconstructed
  host are explicitly inferred. Open carports and ordinary circulation stay open.
- Furniture now has metre-sized rounded profiles, upholstered assemblies, curved
  chair backs, round/oval tables, recessed ceramic bowls and distinct construction
  finishes. Preserve source rotation, variant and type-specific height. Share
  geometry/materials with explicit ownership; software previews retain the actual
  simplified silhouettes instead of replacing every part with a box.

Applied the supplied Three.js procedural buildings, geometry, materials and visual
validation guidance. Native canvas inspection confirmed Three.js r186 WebGPU.
Screenshots are actual renderer captures, not generated images. The furniture
studio is an authored geometry check and is not evidence of AI source accuracy.

Verification: backend full suite 146 passed, one optional Redis check skipped;
client 202 passed; type checks, production build and API 200-line gate passed.
Additional focused checks cover garage inference, real basin recesses, resource
release, opening bridges, false foyer notches and sectional panel travel.

The final live interpretation used one generation and one repair, taking 74.8 s
in this local run. That latency is not an immediate-result performance claim.
The corrected canonical model contains 41 walls, 13 doors, 8 windows, 15 rooms,
10 furniture/fixture objects and one structural slab. Its remaining review items
are the unhosted closet entrance and the stair's unknown destination. This is a
reviewable reconstruction, not a certified complete or photorealistic building.

Local evidence: `.local/mansion-final-flow-live.log`,
`.local/mansion-final-compiled-evidence.json`, and actual WebGPU screenshots under
the repository `.local/screenshots`. A replay harness that reintroduced measured
strokes was not counted as a successful live reconstruction. The fresh proposal
was compiled with the same buildable-candidate filtering used by the client.
The original PNG remained unchanged; no existing user project was replaced and
no changes were pushed. Private QA models are imported only in development and
are excluded from the production bundle.

### 28. Source replacement and reconstruction consistency (2026-10-18)

Replacing a floor source now clears all of that floor's old geometry together:
furniture, architectural details, ramps, stair guides, roofs and level systems,
as well as walls, rooms and structural elements. Stair connections and their
slab openings are removed together. Other floors, shared sources, manual site
boundaries and roof design settings are retained. The inspector selection is
cleared, the prior raster/PDF remains cached for Undo, and replacement uses the
latest editor document after decoding the file. First imports on manually
designed floors do not discard their model or another floor's source.

Reconstruction status, uploads, cached tasks, review subscriptions and automatic
application are scoped to project + floor + source. Late work from a replaced
source cannot update or apply to the new source. Source panels remount when that
identity changes, remain mounted during collaboration navigation, and superseded
pending jobs are cancelled where their job IDs are available. Initial cache
restoration cannot overwrite a newly started request. The progress panel only
marks the 3D model stage complete after acceptance; blocked results no longer
claim that a model has been erected or that discarded geometry is preserved.

The related footprint failure had a separate reproducible cause: a disposition
could confirm a native line while its alignment was corrected elsewhere, then
the merge restored the original outside-footprint measurement. Native-only
measurements contradicting the interpreted envelope now remain unclassified
review evidence. Explicit interpreted geometry still undergoes full footprint
validation; invalid envelopes cannot suppress evidence.

Verification: 150 API tests passed, one optional Redis check skipped; 212 client
tests passed; type checks, production build and source line gate passed. Browser
checks used the unchanged original mansion PNG with a simulated service: replacing
cleared the old furniture and stale slab selection, a late old result was ignored,
and the next reconstruction requested the new source ID. Screenshot:
`.local/screenshots/source-replacement-progress.png`.
The same browser check then applied the validated local replay, opened its actual
3D geometry and marked the model stage complete. Delivering another old result
did not replace its applied status. Screenshot:
`.local/screenshots/source-replacement-applied.png`. The temporary harness logged
development refresh warnings and a Three.Clock deprecation warning; the applied
model and its status remained visible and consistent.

A local replay of native measurements plus the previously recorded Gemini
proposal reproduced `OUTSIDE_FOOTPRINT` before the fix and compiled after it:
41 walls, 13 doors, 8 windows, 15 rooms and 10 furniture/fixture objects. No new
Gemini request or R2 upload was made for these checks. The existing stair
destination and closet entrance remain review items. Evidence:
`.local/source-replacement-native-check.json`,
`.local/source-replacement-api-verify.log`, and client
`.local/source-replacement-tests.log` / `.local/source-replacement-build.log`.

### 29. Asterion Tower showcase (2026-10-19; native graphics acceptance blocked)

The backend catalogue now includes an authored 48-storey Commercial office
tower. Its seven layouts comprise a three-storey podium, 21 linked lower office
storeys, a sky lounge, 22 linked upper office storeys and an executive floor.
Both office groups use the existing template editing and detachment controls.
Lift shafts align through the layouts; two real U stairs connect podium levels.
Continuous travel through linked tower stairs and animated lifts are excluded.

The model includes furniture, meeting areas, washrooms, columns, a glazed
entrance and canopy, curtain walls, mullions, fins, guarded setbacks and a
screened crown. Three explicit roof sections close the podium, tower and crown;
the podium roof has a tower void. Curtain walls own the repeated tower shell.
Authored decks are independent of internal partition bounds, so editing an
office template does not shrink its slab to the core. The sample is an authored
showcase, not a claim about automatic reconstruction of arbitrary drawings.

Optional catalogue metadata supplies a real model poster and preferred opening
view. Open and Duplicate create independent backend projects and request model
view; existing samples retain their defaults. Cards and the level summary count
represented elevations separately from editable layouts. Existing seven samples
are preserved. No database migration or deployment configuration is required.

Compatible captured floor geometry is combined by finish and remains instanced
by storey. Custom materials, reflected transforms and partial draws stay in their
original packages. Material comparison uses texture identities without encoding
image pixels. Walls, doors, stairs, slabs and room finishes now reuse matching
standard materials through the existing resource scope. Tests cover ownership,
last-reference disposal, finish isolation, transformed geometry and custom
material preservation. Development canvases expose actual linked-package counts
for inspection; no frame-rate or GPU-time claim is made.

Visual inspection also corrected distant floor-finish depth flicker and camera
framing for high isolated floors. Office fins now repeat with their floors, so
isolating a template does not leave the whole tower's fins above it. Development
hot reload preserves shared-material context identity. The preview asset is
`client/public/samples/asterion-tower.webp` (960 x 720, lossless WebP), cropped
from `.local/screenshots/asterion-full-building.png`, an actual Three.js r186
WebGL render. No generated image or private source drawing was used. Original
full-model and lobby screenshots, plus desktop/390px phone card checks, are in
`.local/screenshots/asterion-*.png`. The phone check had no horizontal overflow;
the poster loaded at its expected dimensions and plan preview remained available.

Verification: 224 client tests passed as a complete run. API verification passed 151 tests
with the optional Redis check skipped. Template integration checks exercise all
eight templates, separate copies, tenant/template edits, save/reopen and a
detached floor while preserving 48 storeys. Production build and type checks
passed; logs are in client/API `.local/asterion-*` files.

After restarting the browser, the latest code rendered cleanly with WebGL and
no console errors. Actual canvas diagnostics recorded 20 and 21 repeated floors
in 42 and 43 packages (182 source packages per group), with 7,820 and 6,090
instances after the fin correction. Together with seven authored levels these
represent all 48 storeys. No timing or speedup is inferred from these counts.
New office-layout, entrance/podium, sky-terrace and closed crown-roof screenshots
are saved. The corrected poster was verified on the desktop card. An earlier
390px phone capture verified layout and no horizontal overflow; its poster crop
predates the final asset, so a fresh phone capture is still required.

**Remaining review:** a fresh native WebGPU control using the existing house
sample initialized (`graphicsEngine=webgpu`) but screen capture timed out. Opening
the tower successfully created a backend project, then its native renderer also
blocked browser inspection, capture and close/navigation controls. Consequently
native tower rendering, end-to-end Open/Duplicate visual framing and the final
phone capture are not accepted. API tests verify both independent creation paths,
save/reopen, template edits and detachment; these are not native visual evidence.
Full graphics acceptance is incomplete. Nothing was pushed or deployed.


## 30. Compact studio workspace, Projects and fixed-quality navigation

The first compact toolbar was rejected in visual review. It was replaced with a
quiet file bar, a floating labeled drawing/history dock, a separate view dock,
left building panels and right Properties. All six groups retain their existing
components and actions. Panels overlay by default, can be pinned on desktop,
and become full-height sheets on phones. Search (Ctrl/Cmd+K), Escape/focus return,
Split swap/enlarge, Walk/Exit walk and touch controls were exercised. Rejected
editing actions keep their contextual feedback visible above the floating tools.

The revised desktop canvas is 698/768px high (91%); the phone canvas is 756/844px
(90%). Desktop, 820px tablet and 390px phone checks had no horizontal overflow.
Main phone controls are at least 44px. Actual editor screenshots are in
`.local/screenshots/studio-*`; earlier `compact-*` captures show the rejected shell.

Projects defaults to a compact searchable/sortable list, with a persistent grid
switch and a New project dialog. Templates load on demand. Grid previews derive
safe SVG from saved geometry, prefer pending drafts and cache for offline use;
a shared visible-card queue caps requests at two. The authenticated private
preview endpoint checks permissions before revision caching, including 304s.
The Projects route leaves the editor and Three.js in lazy chunks. Empty-state
copy waits for project loading to finish. No source file, R2 asset, database
migration or project-document schema was changed for these controls/previews.

The viewer remains mounted through view transitions, pauses when hidden and
uses fixed quality. Static shadows survive camera movement; geometry, visibility,
lighting and animated doors invalidate them. Linked floor captures exclude
unrelated UI changes. A settled 44-second check including drawer changes submitted
no extra frames, shadows or linked captures after memoizing the viewer.

A controlled tower orbit at Balanced/DPR1 recorded p95 69.8ms uncached versus
40.3ms cached (42.3% lower); CPU submission 48.24ms versus 25.93ms. Both retained
25,840 instances and 2,033 objects. This is WebGL evidence, not GPU timing or a
universal speedup. Detailed measurements and control inventory are in
`COMPACT_WORKSPACE.md` and `.local/compact-navigation-results.json`.

Final client verification passed 228 tests across 54 files after removing the
unaccepted shader-warmup prototype and its experimental coverage test.
API verification passed 152 tests with the optional Redis check skipped. Preview
permission/revision integration checks and production builds passed.

**Open graphics gate:** native WebGPU house output was captured in the production
editor with lighting, roof and fence. The whole-scene tower shader preparation
reported 209,371ms. A proposed warmup reduction stalled during native verification
and was removed. Native tower startup, visual parity and sustained navigation,
GPU timings and sustained walking measurements remain unaccepted. Stationary Walk
still uses a continuous loop. The compatibility renderer remains available before
entering 3D; this does not close the native WebGPU defect. No restart was requested
for the last stalled test; its tab was closed and a usable review page reopened.

Nothing was committed, pushed or deployed; Gemini agent work remains deferred.
