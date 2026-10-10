# Erect 3D — V1 architecture

## 1. Technical architecture
`Project → Building → Level → Element` is the persisted source of truth. The plan editor and WebGL viewer read the same level arrays and share a single selected element ID. Geometry helpers have no React or Three.js dependencies. UI state, document blobs, and transient camera state remain separate from architectural data.

## 2. Domain model
Each project has metadata, source documents, buildings, and settings. A building contains levels. A level contains stable-ID walls, wall-hosted doors and windows, rooms, slab settings, and optional roof settings. Roof settings include form, covering, colour, pitch, and overhang; missing settings in older projects use a default. Walls store endpoints, thickness, height, and material. Openings store host wall IDs and offsets in metres. Rooms store polygons and floor material. Door-owned veranda settings generate a threshold-level slab, three exposed guardrail edges and an optional canopy; their geometry follows the host wall and door offset, including on upper floors.

## 3. Coordinates
All building geometry uses metres on the plan's X/Z plane; height is Y in Three.js. Plan screen coordinates and source image pixels are separate. Calibration stores metres per source pixel plus a source pixel origin. Conversion functions are centralized. Source images have Y down, so plan Z follows image Y to keep tracing intuitive.

## 4. Geometry
Wall meshes are produced from semantic walls. Openings partition a wall into solid intervals and vertical bands instead of dynamic CSG. A footprint creates floor and ceiling slabs. Roof geometry derives flat, gable, hip, or shed faces from the wall bounds and stores its settings with the level. Procedural coverings and edge trims render without external image assets. Wall-to-wall junctions are visually closed by slight overlap at endpoints; robust mitering remains a future geometry refinement. Object IDs survive mesh generation for selection.

## 5. Editor
An SVG plan layer supports high-resolution source images, Ctrl-based mouse-centered zoom, pan, drawing tools, endpoint snapping, selection, and world-unit dimensions. Ctrl-based zoom is routed into the plan or camera while browser page zoom shortcuts are prevented inside the workspace. Both views share pure element transforms for movement, rotation, resizing, endpoint/vertex reshaping and height adjustment. Dragging previews a cloned project, blocks autosave, disables camera orbit, and commits one undo snapshot on release; Escape and pointer cancellation restore the baseline. Openings stay on their host walls, shared wall corners and fitted room/slab/roof outlines stay attached, and stairs update their upper-floor opening only when both floors are unlocked and placement remains valid.

## 6. Renderer
React Three Fiber renders reusable materials and element components from the level model. Wall components rebuild only when their element or hosted openings change. Orbit inspection, overhead inspection, and first-person modes share the same scene. Pixel ratio and shadows are bounded for laptop GPUs.

## 7. Walkthrough and collision
The walkthrough uses pointer lock after an explicit click, eye height near 1.65 m, frame-time movement, and a circular player collider against deterministic solid wall intervals. Open door gaps are passable. For V1's short static wall list this direct analytic test is cheaper and simpler than a BVH or rigid-body engine; a BVH can replace it when scene complexity warrants it.

## 8. Plan analysis
The imported raster is sent to a Web Worker. OpenCV.js composites transparency over white, then performs grayscale conversion, median denoising and Otsu thresholding with separate structural/fine masks. Extraction combines measured axis strokes, paired outlines and Hough diagonal runs, merges overlapping wall bodies, and filters isolated marks and page edges. Fine strokes and quarter-circle arcs provide opening evidence. Repeated rail-bounded treads become stair guides; compact square marks become optional column proposals. Budgets are bounded and reported in review.

World conversion keeps source/analysis bitmap coordinates separate, preserves manual calibration, and otherwise estimates scale from consistent door symbols or wall widths. The accepted wall graph yields bounded room faces and exact floor polygons, with no whole-image slab. Imported roofs are clipped to those footprints. Stair guides keep their detected location and require a fitting reviewed floor connection. There is no OCR, furniture classifier or inferred storey height; candidates stay separate until accepted and need correction on annotated or low-resolution drawings.

Space review choices use canonical polygon keys, then filter the same faces for rooms, floor slabs and roof sections before level alignment is applied. Accepted imports disable implicit slabs and roofs (`autoSlab: false`, `autoRoof: false`) so excluding every enclosure or removing all roof sections does not restore a rectangular building envelope. Roof quantities use section surfaces and footprint clipping.

Imported room faces are unioned into connected roof regions; internal room edges do not create independent roofs. Each region stores an outer footprint and courtyard voids. Clipping subtracts the voids from surfaces and trims ridges at openings. Global roof controls remain available with sections. Normalization repairs legacy generated per-room sections while preserving explicit manual sections. Fence bounds include all ground slabs, rooms and walls; generated fences follow model changes, while manually edited boundaries remain fixed. Fences share selection between the plan and 3D viewer.

## 9. Persistence
IndexedDB stores project JSON and source blobs in separate object stores. Autosave is debounced. Three.js objects, source object URLs, and history are never serialized. Project load reconstructs both views from the saved domain.

## 10. Performance
Keep frame movement outside React state. Bound DPR and shadow maps. Load PDF parsing and analysis only on use. Retain source resolution for zoom while downsampling only the analysis copy. Dispose object URLs and worker instances. Profile frame time, calls, and memory before adding BVH or postprocessing.

## 11. Module plan
Domain types, fixture, coordinate helpers, geometry helpers, project store, persistence, import, worker, plan editor, 3D viewer, walkthrough controller, inspector, and shell each live in focused files. Every source file must stay under 200 lines; build verification checks this mechanically.
