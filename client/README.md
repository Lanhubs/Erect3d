# Erect3D editor

React/Vite architectural workspace sharing one editable model between the plan, 3D viewer
and walkthrough. See the [root README](../README.md) for complete setup and verification.

## Development and builds

Use Bun 1.4.2. Install the root tools and all three packages with the root `setup` command.
Run the API and worker, then `bun run dev` here. The default API proxy is
`http://127.0.0.1:4000`; public client configuration is documented in `.env.example`.

`bun run typecheck`, `bun run lint` and `bun test` verify the editor. `bun run build` builds
the editor plus the separate film package, placing the film at `/motion/erect3d-film/`.
The film is not loaded during editor startup or cached with the offline editor shell.

## Projects, templates and offline editing

Projects and templates come from the authenticated backend. Creating or duplicating a
template creates an independent backend project. IndexedDB caches opened projects,
source assets and pending edits for offline work, then synchronizes when reconnected;
it is not the template catalogue or an alternative project account system.

Projects supports search, sorting, list/grid views and revision-aware floor-plan previews.
Unsynced drafts can supply previews offline. The editor exposes collaboration, roles,
presence, discussion, presentation and revision/conflict review through its existing controls.

## Plan interpretation and model editing

Import original PNG, JPEG or PDF source files. The reconstruction workflow preserves
source quality and provides progress, cancellation and review before replacing geometry.
Server interpretation can use Gemini and measured geometry evidence. Cloud features
require configured server capabilities; manual drawing and existing models remain editable
without AI. Local evidence/furniture analysis remains available where exposed.

Automatic scale is an estimate; manual calibration is optional. Review dimensions,
openings, floor connections and ambiguous symbols before using generated geometry as
an architectural design. Dense annotations and small images can hide important evidence.
Source limits and backend capabilities are validated by the current application settings.

Walls, doors, windows, spaces, roofs, stairs, ramps, slabs, details and furniture share
selection and editing between 2D and 3D. Linked floors support template editing and
individual detachment. Doors expose design/hinge/dimension choices; verandas attach to
entrances and upper levels. Roof form, covering, pitch and overhang remain editable.
Site fences fit around the complete above-ground building envelope; manual boundaries
remain editable. Furniture analysis proposes objects for review rather than replacing the
building structure automatically.

The Assistant accepts model-editing prompts in selection/floor/building scope. It works
through Preview and Apply, retains Undo and rejects stale proposals. An imported source
is optional. Its model-only capability does not require R2 storage.

## Controls

- Plan: Pan or middle drag; Ctrl/Cmd+scroll, plus/minus and zero for zoom/fit.
- 3D: drag to orbit, right drag to pan, scroll/pinch to zoom; on-screen zoom and Fit remain available.
- Walk: WASD, mouse look, Shift for speed, E for a nearby door and Escape to release capture.
- Edit: drag element handles; arrows nudge, Shift refines, brackets rotate, comma/period resize,
  and Page Up/Down adjusts height. Escape cancels a drag; completed edits remain undoable.
- Undo/redo: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. Control search: Ctrl/Cmd+K.
- Levels, source/reconstruction, structure, details, furniture and Properties are grouped in
  panels. Phones use touch-sized controls and sheets; floating interfaces remain exclusive.

Graphics quality stays fixed during navigation. Renderer preference and recovery choices
are available before entering 3D. Native WebGPU tower startup remains an explicitly open
issue; WebGL success does not establish WebGPU correctness.

See [ARCHITECTURE.md](ARCHITECTURE.md), [backend documentation](../api/README.md),
[verification](../docs/VERIFICATION.md) and the [film guide](../motion-video/README.md).
