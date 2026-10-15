# Backend floor-plan reconstruction

## Workflow

Import PNG, JPEG or PDF, then choose **Reconstruct with backend AI**. Local projects
open a separate authenticated backend copy; the local original remains available.
Use **Use local analysis instead** for the existing browser workflow. Cloud imports
do not automatically run OpenCV or accept browser wall candidates.

In Cloud tools choose **Backend AI · source directly** and **Reconstruct this floor
from the source**. Grant provider consent, then request the proposal. The request can
optimize/upload the private source automatically. The worker must be running on the VPS.

The default direct workflow measures native-resolution pixels, then makes one coordinated
source interpretation for a simple plan. Dense drawings use global understanding followed
by four concurrent native regional reads. One client analysis request starts the workflow;
progress arrives through the existing authenticated project WebSocket. The workspace shows
the current stage, elapsed time and Cancel even while Project tools is closed. A disconnected
connection uses a non-overlapping 15-second fallback; terminal results stop status reads.
Server validation errors trigger at most one additional source repair in direct mode.
The direct provider deadline is 60 seconds; timeout returns a failure or retained blocked
proposal, never an endless retry. Completed reads from failed jobs or unavailable repairs
can be reused only with the exact same source/document hash, settings, revision, model,
schema and prompt version. Reused-pass provenance names the previous analysis.
**Advanced → Extended review** retains the older sequential pipeline and two repair attempts.
Invalid geometry remains blocked and never silently loosens footprint, host-wall or slab
validation. Empty wall output fails as `AI_NO_STRUCTURE`.
Prompt version 16 uses server OpenCV measurements as geometry evidence and AI to
classify court markings, dimensions, tread repetition and other non-wall symbols.
Unclassified measurements stay unknown instead of becoming walls automatically.
Native thin-stroke measurements retain single-pixel room partitions for classification
in regional reads or the extended pipeline's audit; denoising does not erase that evidence. Optional
audit/repair failures retain completed geometry for review instead of losing the result.
Dense drawings automatically get four overlapping native crops, even for small rasters.
Every measured stroke belongs to one region; new IDs and opening hosts are scoped to
prevent collisions. All output coordinates remain on the complete image. Failed regions
cannot publish a partial building as complete. Every provider request retains the original PNG/JPEG bytes; crops have
native-resolution lossless PNG pixels. No resizing, flattening or lossy JPEG conversion
is used. Sources above the current 10 MiB provider image limit fail explicitly, retaining
the original. Old saved results do not override a reconstruction from the current pipeline.

For PDF, the worker reads the frozen, project-owned original PDF and checks its SHA-256.
Gemini receives the original document and selected page raster together, so sections and
schedules can supply context. Geometry uses the selected page's coordinates; different
floors are not superimposed. Native PDF input is limited to 50 MiB / 1,000 declared pages;
split larger documents. No original document is retrieved from arbitrary URLs.
[Gemini PDF support](https://ai.google.dev/gemini-api/docs/document-processing).

## Review and editable 3D

- Select the complete reconstruction or review individual elements and source overlays.
- **Compare current / proposed 3D** requests a canonical model from the server's
  authenticated `POST /api/v1/analysis/:id/preview` endpoint. The backend compiles and
  validates this exact selection; the browser renders it without interpreting the drawing.
- A new direct request applies a compiled result automatically and switches to 3D when
  validation passes and no material detail-regression warning exists. Cached result loading
  never replaces the model. Blocked/incomplete results preserve the existing floor and show
  the correction in the visible progress card. Manual review remains available.
- Choose **Apply reconstruction to this floor** after reviewing a pending proposal. Its walls, openings, rooms,
  columns, slabs and furniture are replaced atomically through normal document operations.
  Other floors, roof choices and manual roof sections are preserved. Generated roofing is
  fitted to the reviewed building envelope, preserving void openings; automatic fences are refreshed.
- The same compiler serves preview and acceptance, with deterministic entity/slab/roof IDs.
  Existing editing, door interaction, walkthrough, quantities and undo/redo use normal
  canonical entities. A preview never writes the document.
- Enhancement remains available to retain existing IDs and confirmed design properties.
  Connected stairs block destructive floor replacement; use enhancement for those floors.
  Source/calibration changes or intervening model revisions require a fresh review.

Source-only stair footprints remain guides until an upper floor is confirmed; they do not
expand roofing or require an AI repair merely for lying outside the enclosed footprint.
Two-point stair detections remain review evidence and are not erected. Real connected stairs
still enforce the building envelope. Fixture diagonal corners validate the same bounding box
used by the asset converter. Nearby column bodies can fit the estimated envelope only with
native pixel support and a connected polygon union; blank margins remain excluded.
Validation collects independent element errors for one repair. Temporary element omission
is diagnostic only and never becomes an accepted partial structure.

Large replacements and Undo coalesce changed floors and interpretation metadata into
bounded atomic entity patches. The existing 512-change and 2 MiB client transaction limits
remain; permissions, revisions, document size, geometry and locked-level checks still run.
Collaborator lock checks include both removed and replacement entity IDs, including when
a whole floor is patched. Apply failures leave processing state and show the actual error.

## Latest browser verification — direct workflow (13 October 2026)

The original 708 × 551 arena source was tested in a separate synthetic QA project.
The first complete regional attempt returned 119 wall candidates, 14 spaces and the
depicted basketball court, but failed validation and its optional repair timed out at the
60-second deadline. A separate global read also timed out; it did not replace the model.
After fixing fixture corner validation, source-only stair handling, source-supported column
envelopes and collecting all host errors, recovery reused the five completed source reads.
One real Gemini repair completed in 51.9 seconds and produced a valid, reviewable proposal.
No source pixels were reduced, and reused passes are recorded in provenance.

Applying exposed and resolved a 512-change replacement bug. The browser then applied the
completed result directly and switched to 3D at revision 10. Canonical geometry contains
120 editable wall segments, 7 doors, 14 rooms, 13 columns and 11 fixtures. Eight stair/ramp
footprints remain guides. Undo synchronized the previous 122-wall model at revision 11;
Redo restored this reconstruction at revision 12. Zoom and presentation controls worked.

This is integration evidence, not a perfect or instant arena reconstruction. Two wall
measurements remain uncertain, scale is inferred, no windows were established, and upper
floor connections, elevations, seating tiers and complete curved facade detail remain
unverified. The user’s real project was not replaced. No commit, push or deployment.

Final checks: 110 API passes / 1 Redis skip / 0 failures (741 assertions, 29 files);
166 client passes / 0 failures (1,880 assertions, 39 files). API typecheck, the
200-line source gate (157 files, maximum 160 lines), frontend production build and
Git whitespace checks passed. The build retains its existing large-chunk warning.
Reload retained revision 12; the synthetic QA account was signed out afterward.

## Local verification (12 October 2026)

The previously queued `stadium floor plan.png` request completed against Gemini using
its recorded source-specific consent. One additional compiler-guided repair pass
resolved invalid opening hosts, outside stair symbols and an unhosted outdoor void.
The final proposal contains 39 elements; canonical compilation produces 24 wall
segments, four doors and 13 spaces. Scale and six stair connections remain review
warnings, and no windows were established. No acceptance or project replacement was
performed. This verifies processing and model compilation, not architectural accuracy
or complete stadium seating/elevation reconstruction.

API and client regression suites passed (Redis integration skipped without its service),
as did the production build. Focused tests cover exact-request execution, permission
checks, empty geometry, compiler-guided repair and duplicate-safe resume.
The live browser QA imported a generated drawing, clicked reconstruction once without
setting options, received the automatic 3D preview, and applied seven walls, four doors,
three windows and four rooms. The editor switched to 3D and synchronized revision 2.
This used a separate synthetic QA account/project, which was signed out afterward.

## Validation and limits

### Arena source verification — 13 October 2026

The supplied arena PNG is 708 × 551 pixels, 195,562 original bytes, SHA-256
`5d456dfa1809c802877a5d63b5db0fde7081e0de788baba82bb5d08c45b7a69a`.
ZIP storage uses 192,243 bytes and restores that exact file. Both the full original
and native-resolution detail crops are used; no lossy image reduction was applied.

Native OpenCV found 49 primary wall measurements, 400 fine stroke measurements and
5,119 thin features. Gemini classified the fine strokes in four 100-item batches:
65 confirmations and 335 rejections, with no provider failures. The focused audit
reused the prior real Gemini reconstruction for the remaining passes, including its
validated repair. The resulting proposal compiles with the latest server code:
122 walls, 15 doors, 21 columns, 14 rooms and four tables. Stair/ramp footprints and
unhosted circulation passages stay visible as source guides rather than fabricated
stairs or walls. Fine audits are restricted to measured IDs and cannot erase hosts
or redraw the baseline; invalid additions preserve the validated model.

The browser now prefers the current backend result over an older device-cached job.
Backend proposals open with the roof hidden so the structure can be reviewed.
The roof uses the reviewed envelope and preserves explicit user designs. The source
does not establish vertical clearance, seating tiers, upper-floor connections or
window geometry. Scale is inferred from the depicted court, not a readable dimension.
Curved facade continuity and completeness of tiny room partitions still require
architectural review; this result must not be described as a perfect arena model.

The proposal was applied through the browser in a separate synthetic QA project.
The editor switched to 3D, synchronized revision 1 and retained all 122 walls after
reload. Zoom controls worked. A roof design edit synchronized and remained undoable
after periodic backend refresh; equivalent snapshots no longer discard editor history.
Switching from Flat to Gable now starts at a valid 24-degree pitch when the previous
pitch was zero. The QA roof was restored and the synthetic account signed out.
The user's real project was not replaced. This verifies integration and editing,
not completeness or fidelity of every interpretation.

Earlier regression checks: 94 API passes / 1 Redis skip / 0 failures (637 assertions,
25 files); 162 client passes / 0 failures (1,863 assertions, 37 files), API typecheck,
source-length gate and production build. A client sample-render test timed out once
at five seconds while tests/build ran concurrently; it passed alone and the complete
suite passed with a 15-second timeout. Production build still reports large chunks.

The server rejects missing wall structures, invalid opening hosts/heights, crossed room
polygons, duplicate IDs and geometry outside the understood building footprint. These
checks keep white margins out when a reliable footprint is established. Failure appears
as a review issue; no fallback box or unsupported automatic roof is substituted.

Readable dimension evidence can refine automatic scale without requiring point selection.
Manual scale is retained. Dimensions inferred from door sizes remain clearly provisional.
Unannotated heights, finishes, roofs and ambiguous symbols cannot be recovered exactly
from a raster alone. Source fidelity and architectural accuracy require representative
labeled-plan evaluation; deterministic model validity is not a perfection certificate.

## Verification

Automated checks cover source-first input, repair passes, PDF ownership/hash/page context,
scale preservation, margin exclusion, crossed polygons, deterministic previews, explicit
replacement approval, idempotent acceptance and preservation of other floors/roof choices.
An isolated test database is separate from the live local synthetic QA project.

Earlier checks: **72 API tests passed / 1 Redis skip / 0 failed** (471 assertions,
19 files); **151 client tests passed / 0 failed** (1,820 assertions, 35 files).
API typecheck/source-length gate and frontend production build passed.

A real seven-pass Gemini reconstruction of the generated 700 × 500 plan returned
7 walls, 4 doors, 3 windows and 4 rooms. The browser requested and rendered the server
preview. Scale was explicitly marked inferred because this synthetic drawing has no
annotated measurements. This proves the source-to-model integration, not client-plan accuracy.
Acceptance at revision 12, undo to the previous model, redo and reload retained the
reconstruction. The entrance door was selected and changed using normal design controls,
then restored with Undo. No deployment or push was performed.

The provided `30x50-Model-landscape.pdf` was inspected locally with Poppler and pypdf,
then imported through the browser into a separate local backend QA project. Its single
page raster is 2,526 × 1,785 pixels. The 30′ × 50′ annotations describe the compound;
the house has a concave envelope with outdoor parking and planting. The original PDF
was retained byte-for-byte (SHA-256 verified). Lossless raster optimization reduced
combined storage from 649,514 to 539,589 bytes. No manual scale points were required
for import; Gemini's annotated scale and reconstruction accuracy remain unverified.

Provider approval for this specific PDF/page is pending. A separate verifier is guarded
by the exact project, owner, original/raster asset IDs and SHA-256 hashes, selected page,
fresh model context and single job ID. No private client plan is sent without source/provider
consent, and no general worker was started. R2 still returned 403 AccessDenied;
production bucket access, Linux/VPS operation and live PDF accuracy remain staging gates.
