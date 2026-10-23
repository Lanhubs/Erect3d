# Compact workspace and Projects verification

## Control inventory

The existing editor components remain mounted in their drawers. Their fields,
validation, permission checks, counts and review actions remain in those components.

| Existing controls                                                                                                  | Location                                                       |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Projects, project name, device-save state                                                                          | Quiet file bar                                                 |
| Undo, Redo, Save                                                                                                   | Floating drawing dock; Redo in More on phones                  |
| Select, Pan, Wall, Curve, Ramp, Door, Window, Room, Measure                                                        | Floating labeled drawing dock; Build menu on tablet/phone      |
| 2D, Split, 3D                                                                                                      | Floating view dock                                             |
| Walk / Exit walk, Analyze, Present                                                                                 | Floating view dock; Analyze/Present in its More menu           |
| Tool discovery                                                                                                     | Find a control; Ctrl/Cmd+K; searchable panel keywords          |
| Floor selection, visibility, isolation, lock, name, elevation, floor height                                        | Levels drawer                                                  |
| Level duplication/deletion/creation, underlay, plan offsets, represented storeys                                   | Levels drawer                                                  |
| Import/replace plan, source filename/dimensions, PDF page selection, source warnings                               | Source & reconstruction drawer                                 |
| Estimated span, reuse ground scale, optional point calibration                                                     | Source & reconstruction drawer                                 |
| Reconstruct, view result, local detection choices, detection overlays, accept/discard, opening/room/detail reviews | Source & reconstruction drawer; existing backend review dialog |
| Slabs, slab openings, columns, stairs, guides, flight connections, ramps, seating                                  | Structure drawer                                               |
| Railings, screens, fins, canopies, parapets, pergolas, arches                                                      | Architectural details drawer                                   |
| Furniture detection, candidates/review, visibility, placement and type                                             | Furniture drawer                                               |
| Selected wall/door/window/room/slab/column/stair/ramp/detail/furniture fields                                      | Right Properties drawer, opened on selection                   |
| Roof design, sections, materials, shape, pitch, footprint, construction                                            | Properties drawer                                              |
| Fence enable/generate/edit and architectural systems, linked floors and detachment                                 | Properties drawer                                              |
| Grid, snap, fit plan                                                                                               | Plan viewport header                                           |
| Orbit/top, roof visibility, zoom +/-/fit                                                                           | 3D viewport header and overlay                                 |
| Render quality, full/isolated/exploded building, sections, ceilings, surroundings, furniture, door opening         | 3D View options                                                |
| Walk speed/start/viewpoints/minimap and walkthrough input                                                          | Walk/View options; existing walkthrough controls               |
| Level, counts, units and sync                                                                                      | Compact footer; full sync details in its menu                  |
| Retry sync, conflict review, device draft export, secondary-tab recovery                                           | Footer sync menu                                               |
| Project tools, access/sharing/history and backend review controls                                                  | Existing Project tools drawer                                  |
| Reconstruction progress, errors, cancellation and details                                                          | Existing footer progress trigger/popover and review dialog     |
| Phone Split preview, swap, enlarge/shrink                                                                          | Canvas preview and its two controls                            |
| Editing/zoom shortcut guidance                                                                                     | File-bar Help; More on phones                                  |

One overlay drawer opens at a time. Levels, Source and building tools open on the
left; Properties opens on the right. A panel selector retains access to all six
groups while a drawer covers the rail. Desktop Pin reserves 300px on the left or
312px on the right. The quiet 44px file bar contains no row of primary actions.
Drawing/history and view controls float independently above the canvas.
Phone drawers act as modal sheets. Escape dismisses a menu before its drawer;
focus returns to the previous connected control. Text inputs retain native Undo.

## Projects and private previews

Projects opens in list view. The grid preference persists on the device. Search
and three sort orders operate on project metadata. The creation form is a dialog.
The template catalogue is requested only when Templates is opened. CloudWorkspace
and its viewer are lazy imports, so the Projects route does not initialize Three.js.

`GET /api/v1/projects/:projectId/plan-preview` returns `{revision,levelName,svg}`.
Permissions run before cache/ETag handling, including 304 requests. The derived SVG
contains numeric geometry and fixed styling, with no source image or user markup.
The server cache is bounded to 128 revision entries. Grid previews use visibility
observation and a shared queue with at most two requests in flight. Unsynced drafts
take precedence; account-scoped cached previews and project drafts support offline use.
No document schema, database migration, original-file change or R2 upload is involved.
A later resume displayed the two cached projects while the isolated API/preview
were stopped. Restarting those services and reloading restored their Saved state;
the normal development services were untouched.

## Rendering ownership and measurement

The same viewer remains mounted through Split/3D/presentation and hidden 2D states.
Hidden viewports stop frames and walking input. Walking retains its player and builds
collision/grounding data only on entry or relevant geometry changes. Auto resolves
to Balanced. Navigation never changes resolution, lighting, materials or geometry.

Environment generation and shader preparation share one viewport owner and queue.
Cancelled preparation releases its environment. R3F owns adopted renderers; an
initialization finishing after cancellation disposes its unadopted renderer. Recovery
offers Retry and an explicit compatibility preference after slow/failed startup.
The preference is also available in Projects before opening a model.

Static shadow maps invalidate on model, lighting, visibility, section, furniture,
instance-buffer or animated-door changes. Camera movement alone does not invalidate
them. Linked floor preparation preserves slab identity and excludes unrelated floor
geometry from recapture dependencies. Existing instancing and floor picking remain.

Development diagnostics expose renderer identity, camera, linked captures and shadow
invalidations. `/dev/graphics?scene=asterion-tower&renderer=webgl&optimized=1&trace=orbit`
records six windows after warmup. `shadowCache=0` is the controlled uncached-shadow
comparison; `skip=environment,warmup,shadows,presentation` isolates startup features.
CPU submission measurements are not GPU timings. No GPU speedup may be inferred
from draw-call reduction alone.

## Evidence and remaining acceptance

Final delivered client suite: 228 passed, zero failures (54 files;
`.local/studio-final-tests.log`). The experimental warmup prototype and its
extra test were removed before this final run. API verification: 152 passed,
one optional Redis test skipped, zero failures. Private-preview integration checks
also passed separately (13 assertions). Client production build and type checks passed.

Actual revised studio-shell check at 1366x768: 698px canvas (91%), closed drawers,
no horizontal overflow. The 390x844 phone canvas is 756px (90%); floating main
controls have 44px or larger touch targets. Tablet 820x1180 has no overflow.
Left-panel pinning reserves 300px and releases it on unpinning. Properties opens
on the right. Phone Source uses a full-height sheet; Escape restores focus to
Panels. Search, panel selection, Split swap and Walk/Exit walk were exercised.
Grid previews loaded on phone; list switching and desktop list display were checked.
Dynamic editing feedback remains visible above the tools when an edit is rejected.

Actual editor screenshots are in `.local/screenshots/studio-workspace-*.png`;
Projects screenshots are `studio-projects-*.png`. These replace the earlier
`compact-*` shell captures that the user rejected. They are actual Three.js
screenshots, not generated mockups.

At fixed Balanced quality, DPR 1, 1280x720 viewport and 1280x551 canvas, the
controlled tower orbit comparison recorded median p95 of 69.8ms with uncached
shadows versus 40.3ms with cached shadows (42.3% reduction). CPU submission fell
from 48.24ms to 25.93ms (46.3%). Both retained 25,840 instances and 2,033 objects.
Draw calls changed from 3,805 to 2,041 because camera-only movement reuses static
shadow maps. GPU timing was not measured. Raw traces and sampling rules are in
`.local/compact-navigation-results.json` and `navigation-{control,after}-tower.json`.
The original tower baseline had hot-reload interference and is not used for the
percentage claim. House p95 varied between runs; no universal speedup is claimed.

Repeated Split/3D/presentation transitions retained renderer identity, camera,
linked capture counts and shadow invalidation count (`.local/view-transition-check.json`).
Zoom left static shadows unchanged; roof toggling invalidated them
(`.local/shadow-invalidation-check.json`). Hidden 2D paused frame submission. After memoizing the viewer and stabilizing its
exit callback, a 44-second settled check (including opening/closing Levels) retained
exactly one submitted frame, one shadow invalidation and one capture per linked
group (`.local/studio-idle-check.json`).

A clean production house test confirmed actual `graphicsEngine=webgpu` output
with full lighting, roof and fence. Preparation reported 9.1 seconds; visible output arrived later, so that number
is not end-to-end first-paint time. Screenshots are
`studio-native-house*.png`. Native preparation of the complete tower took 209,371ms
in the former whole-scene warmup. This identifies per-object shader preparation
as a concrete remaining startup bottleneck. A representative-layout prototype identified 210
layouts, but its native check stalled and it was removed rather than shipped.
The delivered code retains the whole-scene warmup. Initial demand rendering
flushes three frames before resting. Native house pixels are accepted, but the
native tower startup/parity/navigation gates remain open.
WebGL results do not close that gate; GPU timing and sustained walking measurements
are not recorded as accepted. Stationary Walk currently retains a continuous frame loop.

No Gemini agent work, commit, push or deployment was performed for this change.
