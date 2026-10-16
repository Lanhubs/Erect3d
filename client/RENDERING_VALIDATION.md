# Rendering and interpretation validation — 15 October 2026

## Contracts applied

The supplied Three.js skill routes were read before these changes: choose-skills,
procedural-buildings-and-cities, procedural-geometry, procedural-materials,
scalable-real-time-shadows, image-pipeline, visual-validation and camera-controls-and-rigs.
Their upstream repository is [threejs-complete-set-of-skill](https://github.com/linegel/threejs-complete-set-of-skill/tree/main/skills).
The installed Three.js 0.186 APIs take precedence over examples targeting r185.

Architectural records remain canonical metre-based JSON. Meshes, GPU resources,
camera state and debug measurements are never saved as building geometry.
`Building.systems` extends existing floors with cores, shafts, voids, beams,
curtain walls, massing and linked typical floors. Existing projects remain valid.

## Verified changes

- Source-bound cores reuse existing walls and openings. Their upper extensions
  preserve semantic wall arcs. Facades subtract actual entrance openings.
- Wall-band reconciliation retains the complete source span and the body's
  thickness/centreline. A tiny fragment or thin edge cannot replace the whole wall.
  All opening and architectural boundary references follow the resulting identity.
- Architectural systems participate in shared move/reshape/rotate/scale/height
  editing. Source wall corners, openings, room/slab outlines and fitted roofs follow.
  Invalid changes roll back, and locked levels reject edits.
- Linked floors capture one existing floor emitter tree, including its actual
  materials, stairs, ramps, furniture and details. Instanced draws reuse that
  geometry across elevations. Material regions retain their own index ranges.
  Owned geometry is disposed independently of borrowed template resources.
- Current-floor inspection hides repetitions and slices vertical systems.
  Entire-building inspection frames the full semantic height.
- Roof canopy regions retain distinct top/glazing/fascia/soffit slots. Only
  referenced vertices are uploaded; region ranges and normal ownership survive.
- Geometry/budget failures are reported visibly instead of silently dropping floors.

## Exact PDF check

The supplied `5 storey floor plan.pdf` contains fourteen sheets, including paired
floor drawings, basements, ground through eighth-floor drawings and elevations.
The filename is not used as evidence for floor count or repeated layouts.

Original: 4,539,018 bytes; SHA-256
`15aef3f62a97d1c5cd312475c12c787fd29efbbe64e0d2e9064e517da1450f76`.
The original was stored with lossless ZIP and verified unchanged after processing.
Page 3's right-hand ground-floor drawing was selected for this check. Native
page rendering is a derived view; the original PDF was also supplied to Gemini
with the user's explicit authorization. No source pixels were JPEG-compressed.

The first network attempt failed, then the initial document deadline expired.
The PDF is now read once globally; regional passes receive the page/crops and
global context instead of repeatedly uploading the full fourteen-page document.
The document-specific global deadline is bounded at 65 seconds, within the job's
overall deadline. Image-only global reads retain the shorter deadline.

A real provider run completed in 94.2 seconds but its original model was blocked
by eight opening-host errors. Replaying its saved real regional and repair outputs
after the wall-band fix compiled 41 walls, 8 doors, 15 windows, 10 rooms, 15 columns,
15 fixtures and 9 stair/entry guides without compiler errors. Scale used the source's
13.73 m annotated dimension. This replay made no additional Gemini requests.
The result remains **needs-review**, due to uncertain fine strokes and stair links.
It was rendered in native WebGPU and forced modern WebGL2; no runtime errors were
reported during those checks. The user's existing project was not replaced.

A subsequent fresh authenticated upload/reconstruction/preview request with the
corrected pipeline completed in 94.0 seconds. Its normal server preview compiled
29 walls, 8 doors, 15 windows, 11 rooms, 16 columns, 17 fixtures and 10 guides, with
no geometry errors and a provisional hidden roof. Five fine-stroke warnings and
unconnected stair guides remain review items. The difference from the earlier
replay demonstrates provider variability; these counts are not a completeness score.
The original SHA-256 remained unchanged. No user project was replaced.

This is a selected-floor check, not automatic reconstruction/verification of every
storey in the document. Different upper-floor layouts must not be copied blindly.

## Visual and performance evidence

The 32-storey model is a synthetic fixture: one canonical level, 31 linked instances,
an editable core/facade and a crown. It is not a reconstruction of this PDF.
The arena High-quality native WebGPU exterior and current-floor isolation were
visually checked. The source-derived office floor and WebGL2 path were also checked.
Private screenshots and raw source responses remain in ignored local directories.

The development comparison fixes DPR at 1 and remounts the renderer between
variants. Measurements record actual drawing-buffer dimensions. Adaptive
resolution remains enabled in the normal editor. Comparisons must keep viewport,
camera, roof state and quality unchanged. CPU submission time is not GPU timing;
unavailable GPU timestamps/memory metrics must remain unavailable, not zero.
The results overlay cannot change canvas size, pause gaps clear accumulated CPU
timing, and a case with insufficient samples terminates explicitly at 45 seconds.
Initial comparisons made before these corrections are not accepted as performance
evidence. A complete all-scene matrix must not be inferred from a current-scene run.

The client suite passed 179 tests. Its dashboard test builds all nine real samples;
its integration timeout now matches the existing 15-second sample-library budget.
This is a test deadline, not a claim that interactive rendering became faster.

## Remaining acceptance work

The final API suite passed 117 tests with one Redis integration test skipped, and
the production client build passed. Browser automation timed out during the fresh
29-wall preview check; earlier screenshots show the cached replay, not that fresh
result. No final rendering-performance matrix or fresh visual approval is claimed.

- Full multi-sheet floor/section alignment and complete connected circulation.
- Independent source-labelled coverage/fidelity review for all requested typologies
  and a real 30-plus-storey source, rather than only a synthetic tower fixture.
- GPU timestamp traces, device-loss recovery and representative phone/tablet runs.
- A photorealistic reference image is a design target, not evidence that these
  procedural scenes already match its visual quality or architectural completeness.

No deployment, push or commit was performed.

## Building focus update · 15 October 2026

The latest product scope retires new arena/stadium work. Those templates, sports
concept generation and arena roof choices are removed from active workflows.
Existing saved documents still deserialize and display their legacy geometry;
no migration deletes users' work. Earlier arena validation goals above are
historical and no longer acceptance targets for new reconstruction.

Applied skill guidance, using installed Three.js 0.186:

- `threejs-choose-skills`: source measurements and scale own reconstruction;
  rendering cannot correct missing or mis-scaled architectural data.
- `threejs-procedural-buildings-and-cities`: repeated floors share the actual
  template emitters, in independently bounded 64-storey instance pages. Facade
  batches now partition vertically too. Floor picking retains canonical indices.
- `threejs-procedural-geometry`: shared resources remain borrowed; instance
  uploads refresh bounds. Allocation budgets remain explicit, rather than a
  fixed 200-storey architectural ceiling.
- `threejs-scalable-real-time-shadows`: sun direction remains consistent and
  fitted light-space bounds include full building height and ground shadows.
  Camera clipping and automatic crowns also follow the actual building height.
- `threejs-visual-validation`: the 256-storey fixture tests repetition, identity,
  roof height and shadow coverage. It is synthetic, not proof of high-rise source
  fidelity or a photorealistic building. Native WebGPU was visibly initialized.

Reconstruction no longer automatically performs a global AI read plus four
regional AI reads for dense plans. The normal route sends one coordinated request
with the original source, native measurements and lossless detail crops. A sparse
validation repair remains conditional on actual geometry errors. Local host
repairs no longer resend the full PDF or perspective reference; architectural
dimension repairs retain document context. Repair progress is pushed to the UI.

Native processing now scans the selected drawing only, mapping pixel positions
and wall thickness back to original-sheet coordinates. Duplicate edges wholly
contained in established wall bands are excluded from redundant evidence;
extensions and adjacent partitions remain. On the supplied page raster, a local
measurement run took 9.38 seconds for the whole sheet and 3.77 seconds for its
selected drawing. This is one CPU sample, not a sustained latency percentile.

A missing AI scale previously fell back to 12 metres across the complete sheet,
shrinking a building surrounded by margins. New responses require explicit scale
evidence; historical responses without scale fall back to the actual wall network
and consistent door evidence. Estimated scale stays provisional and manual scale
is preserved. Padding-invariance and source-byte-preservation tests cover this.

The latest isolated live office-PDF request completed in 75.8 seconds, including
about 7.6 seconds before the worker ran, versus the earlier 94.0-second request.
It returned 37 walls, 6 doors, 15 windows and 9 rooms with the printed 13.73-metre
reference, and produced a valid server preview. Seven stair connections remain
guides requiring review. Original PDF SHA-256 is unchanged. Counts and a valid
preview do not prove complete plan fidelity. This is still not immediate; the
provider remains the main latency cost. Subsequent sparse-repair context trimming
has unit coverage but no separate live timing claim.

Illustrative parking, cars and planting are now opt-in under View options. They
do not belong to the source model and no longer add default geometry or obscure
the reconstruction. This also avoids presenting decorative boxes as source data.

### Final verification for this update

- Full client suite: 182 passed. Production build and both typechecks passed.
- Full API suite before the final repair-context change: 122 passed, one Redis
  integration test skipped. The final repair-context/requested-job/backend-flow
  checks passed 11 tests, including the new context-isolation regression.
- All changed source files satisfy the 200-line limit; source whitespace checks
  passed. No commit, push or deployment.
- Visually inspected the corrected 37-wall office preview, roof toggle and native
  WebGPU viewport with no console errors. Screenshot:
  `.local/screenshots/building-focus-office-native.png` in the repository root.
- Completed one fixed-condition 32-storey comparison: Three.js 0.186, in-app
  browser, 1280 × 551 drawing buffer, DPR 1, balanced quality, roof visible, whole
  building, unchanged camera. Three samples follow the five-second warm-up.
  WebGL baseline/batched/native WebGPU each observed about 30 FPS. Draw calls were
  110/110/111; triangles 108898/108898/108899; repeated instances 5897 in every
  variant. Mean CPU submission was 2.93/3.72/11.06 ms respectively. This does not
  demonstrate a WebGPU speedup, a 60-FPS target or actual GPU execution cost.
  Raw DOM-exported results: `.local/building-focus-tower32-comparison.json`.
  No all-scene/device matrix is implied by this single synthetic fixture.

## Architectural construction update — 16 October 2026

The supplied Three.js procedural building, geometry, materials, shadows and
visual-validation guidance is applied through semantic systems and shared render
resources, rather than adding image-generated scenery or post-processing to hide
missing architecture. Three.js remains the installed 0.186 implementation.

### Implemented and checked

- Thirteen editable articulation profiles: canopies, pergolas, fins, colonnades,
  balconies, verandas, cornices, plinths, parapets, railings, portals, arches and
  cladding. Parameters, actual source spans/polygons/arcs, materials, evidence,
  assumptions and origin survive the API and canonical project. Optional design
  proposals are stored hidden until the user includes them.
- Dedicated architectural outlines no longer need to masquerade as rooms or
  walls. Every erected outline must belong to an identified semantic system.
  Gemini's shallow transport requires semantic metadata and height; a dedicated
  spiral-stair array requires every flight dimension. Strict canonical validation
  enforces each remaining kind's dimensions. Sparse repairs receive the failed
  source IDs and existing requirements.
- Concave platforms retain their empty areas. Circular canopies have actual holes.
  Arches have an indexed opening, rather than a decorative tube. Cladding and
  plinths respect hosted apertures; fins leave entrances clear. Veranda guards
  require separate source spans so a default railing cannot block the entrance.
- Windows use actual frame sections, reveal offsets, mullions/transoms, panes,
  sills and hardware. Glazed door leaves have a clear aperture, including double
  leaves. Arc-hosted openings preserve source offsets. Glass is a thin alpha
  blended PBR approximation, not a claim of full optical refraction.
- Details repeat with linked floors only when explicitly enabled. Detaching a
  floor produces independently editable detail identities. Repeated parts share
  primitive geometry/materials and retain allocation budgets and spatial pages.
- Opening inputs are indexed by host: changing one window retains other wall
  inputs and roof inputs. Window material changes retain assembly placements.
- Roof sections always use their authored footprint, including manual sections.
  Roofing has upward normals and a separately shaded soffit. Sun fitting includes
  the actual ridge, with a bounded normal bias. The previous repeating wall-noise
  lattice is replaced with seeded, irregular, lower-contrast sampling.
- Inferred construction properties are recorded per entity and exposed in the
  contextual inspector. Manual edits remove those fields from the defaults list.
- Spiral stairs are dedicated editable circulation entities, with indexed annular
  treads, shared instances, a central support, helical guards and landing plates
  at known levels. Floor and roof voids and walkthrough surfaces use the same
  system. A level inspection preserves the original helical phase. Landing
  angles must meet the flight; collision guards leave the landing openings clear.
- AI repetition without named, matching-layout evidence is retained as a hidden
  design proposal. Seeing a storey count does not copy a unique ground floor.

### Evidence and limits

The full client suite passed **198 tests**; the final full API suite passed
**133 tests**, with one optional Redis integration skipped. API coverage includes
the new provider transport, bounded private downloads, native opening hints and
source repair checks. Both typechecks and the production build passed. Changed source files
remain at or below 200 lines. Authored
regressions cover bungalow, duplex, villa, apartment, office, office tower,
mixed-use, mall, public, irregular/curved and high-rise models. These tests prove
finite geometry, source-model preservation, topology and edit isolation; they do
not prove arbitrary uploaded-plan interpretation or photorealism.

Native WebGPU was read from the actual canvas (`data-graphics-engine=webgpu`),
with a 1280 × 551 drawing buffer. The authored house was inspected from outside
and at its entrance. The double glazed door opened with E and forward movement
entered the room. No browser errors were recorded. Local evidence:
`.local/screenshots/architectural-house-native.png` and
`.local/screenshots/architectural-house-walkthrough.png`.
These are real viewport captures of an authored fixture, not source-PDF fidelity
proof. The screenshot precedes the final wall-noise sampling correction.

The three-floor spiral fixture was also inspected at eye level on native WebGPU
(1152 × 495 drawing buffer), with no captured browser errors. Its actual treads,
handrails, central support and circular slab opening are visible in
`.local/screenshots/spiral-stair-eye-level.png`. Geometry and movement regressions
cover both winding directions, multiple turns, slices, landing gates and holes.
This is an authored circulation fixture, not an automatically interpreted PDF.

### Exact office PDF: completed run and remaining source checks

The last completed default run (prompt 30) took **58.2 seconds**, including queue
time, one coordinated interpretation and one sparse repair. It compiled a valid
selected-ground-floor preview with **21 walls, 7 doors and 6 windows**. Its quality
remained `needs-review`: stair connections need confirmed upper floors and dense
source detail still needs inspection. No existing user project was replaced.
The source is a 14-sheet document, not evidence of five identical storeys.

Native WebGPU captures of that exact partial reconstruction are
`.local/screenshots/office-pdf-v30-native-top.png` and
`.local/screenshots/office-pdf-v30-native-orbit.png` (1280 × 551, no captured browser
errors). Visual review found incomplete side-facade glazing. Prompt 31 restores
bounded native frame/leaf evidence omitted by the compact request and gives
windows their own required response array. Its text-only schema probe and local
regressions pass, but live verification failed first with a closed socket and
then DNS resolution failure for the Gemini endpoint. Do not present the version
30 screenshots as proof of version 31's interpretation quality.

R2 upload was verified with reversible ZIP. Later source reads stalled or failed
DNS checks; private reads now stop after 30 seconds, enforce byte limits and
report storage errors separately from Gemini errors. A downloaded page matched
its original hash, but the complete latest R2 reconstruction path remains blocked
by connectivity. Successful interpretation checks used an isolated local store;
the app's R2 configuration was not changed. The original PDF remained byte-for-byte
unchanged. Private QA model data was absent from the production bundle search.

Automatic detail-to-wall attachments, complete distinct multi-sheet and split-level
floor assembly, a full device/performance matrix, and independent architectural
acceptance remain unproven. No arbitrary-plan perfection or WebGPU speedup is
claimed. New arena/stadium generation remains retired. No commit, push or deploy.
