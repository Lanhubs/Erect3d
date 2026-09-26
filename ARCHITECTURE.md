# Erect 3D — V1 architecture

## 1. Technical architecture
`Project → Building → Level → Element` is the persisted source of truth. The plan editor and WebGL viewer read the same level arrays and share a single selected element ID. Geometry helpers have no React or Three.js dependencies. UI state, document blobs, and transient camera state remain separate from architectural data.

## 2. Domain model
Each project has metadata, source documents, buildings, and settings. A building contains levels. A level contains stable-ID walls, wall-hosted doors and windows, rooms, slab settings, and optional roof settings. Roof settings include form, covering, colour, pitch, and overhang; missing settings in older projects use a default. Walls store endpoints, thickness, height, and material. Openings store host wall IDs and offsets in metres. Rooms store polygons and floor material. V1 edits the first level while keeping the hierarchy extensible.

## 3. Coordinates
All building geometry uses metres on the plan's X/Z plane; height is Y in Three.js. Plan screen coordinates and source image pixels are separate. Calibration stores metres per source pixel plus a source pixel origin. Conversion functions are centralized. Source images have Y down, so plan Z follows image Y to keep tracing intuitive.

## 4. Geometry
Wall meshes are produced from semantic walls. Openings partition a wall into solid intervals and vertical bands instead of dynamic CSG. A footprint creates floor and ceiling slabs. Roof geometry derives flat, gable, hip, or shed faces from the wall bounds and stores its settings with the level. Procedural coverings and edge trims render without external image assets. Wall-to-wall junctions are visually closed by slight overlap at endpoints; robust mitering remains a future geometry refinement. Object IDs survive mesh generation for selection.

## 5. Editor
An SVG plan layer supports high-resolution source images, Ctrl-based mouse-centered zoom, pan, drawing tools, endpoint snapping, selection, and world-unit dimensions. Ctrl-based zoom is routed into the plan or camera while browser page zoom shortcuts are prevented inside the workspace. Edits are committed to the project model. Undo/redo stores model snapshots, including roof settings, without binary source documents.

## 6. Renderer
React Three Fiber renders reusable materials and element components from the level model. Wall components rebuild only when their element or hosted openings change. Orbit inspection, overhead inspection, and first-person modes share the same scene. Pixel ratio and shadows are bounded for laptop GPUs.

## 7. Walkthrough and collision
The walkthrough uses pointer lock after an explicit click, eye height near 1.65 m, frame-time movement, and a circular player collider against deterministic solid wall intervals. Open door gaps are passable. For V1's short static wall list this direct analytic test is cheaper and simpler than a BVH or rigid-body engine; a BVH can replace it when scene complexity warrants it.

## 8. Plan analysis
The imported raster is sent to a Web Worker. OpenCV.js performs grayscale conversion, median denoising, and Otsu thresholding. Candidate extraction then uses horizontal/vertical dark-run grouping and conservative cleanup. Candidates stay separate until accepted; analysis never claims certainty.

## 9. Persistence
IndexedDB stores project JSON and source blobs in separate object stores. Autosave is debounced. Three.js objects, source object URLs, and history are never serialized. Project load reconstructs both views from the saved domain.

## 10. Performance
Keep frame movement outside React state. Bound DPR and shadow maps. Load PDF parsing and analysis only on use. Retain source resolution for zoom while downsampling only the analysis copy. Dispose object URLs and worker instances. Profile frame time, calls, and memory before adding BVH or postprocessing.

## 11. Module plan
Domain types, fixture, coordinate helpers, geometry helpers, project store, persistence, import, worker, plan editor, 3D viewer, walkthrough controller, inspector, and shell each live in focused files. Every source file must stay under 200 lines; build verification checks this mechanically.
