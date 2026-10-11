# Existing client contracts (inspection before implementation)

The frontend has moved into `client/`. Paths beginning with `src/` below are relative
to that directory. The canonical document is `client/src/domain/types.ts:Project`. The API imports its types;
runtime validators validate this format rather than inventing another building model.

## Geometry and identity

Projects contain buildings, levels, source metadata, calibration and units. Buildings
contain roof sections, site fences and saved walkthrough viewpoints. Levels contain
walls (including circular arcs), host-bound doors/windows/passages, rooms, slabs with
openings, columns, linked stairs, ramps, seating, architectural details, stair guides
and furniture. Optional collections must stay optional when loading existing files.
Coordinates are metres in the horizontal x/z plane. Level elevation is vertical.
IDs are strings, commonly `project_<UUID>` / `wall_<UUID>`, not bare database UUIDs.
Materials, roof styles, door styles, verandas and furniture types remain the client's
existing enums. `modified` is a millisecond timestamp, not a collaboration revision.

## Persistence and editing

`src/state/database.ts` stores projects and source blobs in IndexedDB `erect3d-v1`.
Raster blobs use source IDs; original PDFs use `<sourceId>:original`. Object URLs
are reconstructed locally and are never persisted in Project JSON. Replacing a
source clears previous interpretation geometry on that level in one transaction.
`src/state/project.ts` provides Zustand selection, active level, tools, history,
preview and committed edits. Its local version counter is an autosave generation.
Drag previews and every WASD/camera frame must not become server operations.
`elementEditing.ts` and `elementMutation.ts` implement geometry transformations,
host relationships and dependent slab/roof/stair adjustments. Remote edits are
validated canonical document patches; clients commit the full dependent changes
as one operation, preserving these domain rules and local undo behavior.

## Imports and interpretation

`readSource.ts` accepts PNG, JPEG and PDF by magic bytes, up to 200 MB. PDF originals
are separate from selected-page PNG rasters. Rasterization caps the long edge at
3000 pixels. OpenCV analysis is local and bounded; `useAnalysis.ts` fetches blob
URLs, scales source pixels to metres, applies alignment and creates review candidates.
`acceptInterpretation.ts` derives walls/openings, enclosed spaces, slabs, roof
coverage, columns and stair guides. Furniture detection is optional and separately
reviewed. The API supplements these deterministic candidates with semantic cloud
proposals. Explicit acceptance is required; cloud output never directly overwrites
architecture. API normalized image coordinates use x/y, top-left origin, version 1;
the conversion boundary maps y to client z and applies calibration plus alignment.

## Other existing behavior

`sampleLibrary.ts` creates ordinary canonical projects (nine samples), including
complex buildings and furnished examples. Quantity functions under `src/geometry`
derive estimates from actual geometry. Furniture types live in `src/furniture/types.ts`.
Walkthrough state lives in refs; only `WalkViewpoint` is persistent. Presentation
mode hides editing controls but currently has no remote share token or account.
No authentication, teams, remote API adapter, collaboration connection or cloud
save exists. Existing fetch calls load local blobs. No assumed login screen or
remote-only save flow will be introduced by this backend work.

## API boundary

The snapshot envelope adds schemaVersion, revision and checksum outside Project.
Operations carry stable operationId, baseRevision and bounded entity changes.
Authentication and tenancy are relational metadata outside architectural JSON.
Source bytes live in private storage; Project.sources remains descriptive metadata.
`api/client` supplies an optional typed transport; IndexedDB continues to work
without it. Online UI integration is a separate explicit milestone, not an implicit
replacement of the existing frontend.
