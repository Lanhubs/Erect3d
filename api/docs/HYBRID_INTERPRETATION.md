# Hybrid interpretation: implementation and accuracy gates

## Implemented

The default cloud workflow now uses direct-source backend reconstruction; see
[BACKEND_RECONSTRUCTION.md](BACKEND_RECONSTRUCTION.md). Hybrid measurement remains optional.

- OpenCV remains the measurement layer. Cloud tools measure the source without replacing
  the model, retaining normalized original-image coordinates, calibration origins,
  gap hosts, thin lines and optional region crops. Up to 2,000 bounded measurements
  accompany an explicitly consented cloud request.
- Enhancement is the default cloud goal. The server captures the current canonical model,
  entity IDs, protected fields, revision and entity checksums. Gemini compares source
  evidence with that context and proposes corrections or missing geometry.
- Prompt version 7 and storage schema version 5 invalidate old caches. Global understanding
  precedes structure/openings; broader scopes add spaces/circulation, optional details and
  consistency. An opt-in architecture completion pass follows detection. Completed passes
  are independently cached and reused after transient failures.
- Global understanding, consistency and completion cannot publish geometry or removals. Completion
  alone can supply roof/material/glazing proposals. Source annotations remain untrusted
  input; no provider tools or arbitrary meshes are requested.
- A compact provider generation grammar supports Gemini structured output. The full strict
  Zod contract validates every response before publishing a review. Provider failures have
  safe typed codes for credentials, model availability, quotas, rejected schemas and network.
- Duplicate wall aliases retain hosts; distinct parallel walls remain distinct. Gemini
  can exclude spurious measured annotations, page borders and duplicate edges. Confidence
  is reduced for missing hosts, inconsistent arcs and implausible physical measurements.
- Corrections update existing normal entities with stable IDs. Unspecified door designs,
  materials, frames, verandas and roofs are preserved. Captured target checksums reject
  stale corrections. Changes to confirmed fields require separate explicit review approval.
  Manual edits retain field provenance through normal editor history.
- Rejected source evidence can produce optional removals of exact existing walls, openings,
  rooms and columns. These start unchecked, show the source reason and require explicit
  confirmed-field approval. Stale targets and orphaned hosted openings are rejected;
  rooms containing assigned objects cannot be removed until those objects are reassigned.
  No other model elements are silently removed. Generation and polling use separate limits.
- Candidate review includes source overlays, editable points, labels, wall hosts, door
  style/hinge/swing, columns and stair destinations. Current/proposed 3D comparison uses
  the existing renderer and a cloned normal model without changing the saved document.
- Optional roof alternatives, wall finishes and glazing have separate checkboxes and
  inferred/defaulted provenance. Roof alternatives are exclusive; overlapping material
  alternatives cannot both be chosen. Roof proposals use existing roof footprint controls,
  preserving courtyards and normal roof editing. Accepted designs become user-selected.
- Reviewed voids must fit slabs. Stairs can remain guides or connect explicitly through
  the existing rise, footprint, collision and upper-opening validation.
- Acceptance checks source/calibration/alignment, review identities and canonical geometry,
  then commits one idempotent normal document operation. Undo/redo restores the prior state.
  Rejection/cancellation remain separate. Fresh review clears saved request settings safely.
- Private source upload uses lossless optimization before its final object write; production
  storage is Cloudflare R2. See [R2_STORAGE.md](R2_STORAGE.md).

## Live integration verification

The isolated local QA project used a generated synthetic 700 × 500 plan, not a private
client drawing, for actual Gemini calls. Four passes completed: global understanding,
structure, openings and architecture completion. The resulting review contained 14
corrections/missing elements and four optional designs. The browser compared both models,
accepted one wall correction, three missing windows and one hip roof alternative through
the real API, then verified undo, redo and persisted reload. Stable entity counts were
10 walls / 4 doors / 3 windows after acceptance; undo restored zero windows and the prior
gable roof. The intentionally uncompressed PNG shrank from 1,370.0 KiB to 5.7 KiB.

A subsequent real three-pass review proposed removal of three existing walls that were
door leaves or swing-arc artifacts. All removals started unchecked. The browser selected
only those three, approved their confirmed fields, rendered the proposed 3D view and
accepted them through the API. Walls changed from 10 to 7 while 4 doors, 3 windows,
4 rooms and the hip roof were retained. Undo restored 10 walls; redo restored 7,
and reload retained the accepted model at revision 11.

API: **72 passed / 1 Redis skip / 0 failed**, 471 assertions across 19 test files,
in a separate test database to avoid collisions with live QA jobs.
Client: **151 passed / 0 failed**, 1,820 assertions across 35 files. TypeScript and the
production frontend build passed. These checks establish integration and deterministic
behavior; one synthetic drawing does not establish architectural accuracy.

## Remaining architectural work

- Stable wall merge/split operations are not implemented. Existing false elements can be
  explicitly removed through review; unselected removal proposals leave the model intact.
- Deterministic room adjacency graphs, topology confidence and richer typed fixture semantics
  still need work. Confidence percentages are model evidence estimates, not calibrated
  accuracy scores.
- Courtyard/atrium reasoning, ramps, curved hosted openings and structured circulation beyond
  reviewed stair connections and slab voids remain limited. Curved opening edits are manual.
- Completion currently covers roof choices, wall finishes and existing window glazing.
  Regional detail systems, railings, height alternatives and arbitrary modular components
  are not automatically designed.
- Interactive candidate merge/split/rotation, regional tiling for huge sheets, per-pass cost
  budgets beyond request quotas/timeouts, and large-plan performance need measured work.

## Accuracy and VPS gates

Before claiming improved architectural accuracy, run paired OpenCV-only/hybrid evaluations
against labeled drawings: simple/furnished house, villa, two-storey house, apartment,
office, mall, public building, curved building, traditional architecture, poor scan, CAD,
stadium and arena. Track wall precision/recall, duplicates, openings, rooms, columns, stairs,
optional furniture, topology errors, manual corrections, duration, calls and token usage.
Explicitly label courtyards, margins and arena pitches.

The real R2 endpoint rejected signed PUT with **403 AccessDenied**. Correct the configured
bucket/token scope before retrying; GET, browser CORS and cleanup have not been verified live.
Real R2 signed transfers/browser CORS, Linux qpdf, VPS capacity, TLS and recovery remain
staging gates. The user supplies VPS access/configuration later. Keep production public
registration disabled until those checks pass. No deployment or push was performed.
