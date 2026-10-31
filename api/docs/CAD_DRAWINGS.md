# CAD drawings in and out

Erect3D takes floor plans in DXF or DWG and gives them back as DXF or DWG sheets, so a
drawing can start in AutoCAD, become a model here, and return to the same tool for edits.
PNG, JPEG and PDF imports and every existing flow are unchanged.

## Import

Upload the drawing to the ordinary private-asset endpoint, then ask for a conversion:

```
POST /projects/{projectId}/cad/convert   { "sourceId": "...", "assetId": "..." }
```

The request returns a job id immediately. The `cad.convert` job reads the original asset,
detects the container from its bytes rather than its filename, parses ASCII DXF with
`dxf-parser`, and rasterises the geometry and text to an upright PNG. The existing analysis,
review and approval flow then works from that raster exactly as it does for a scanned plan,
and the drawing stays behind the model as a trace overlay. `source_plans` links the source to
its original and raster assets; migration `012_cad_sources.sql` adds `created_at` plus an index
so the maintenance sweep can retire a link that was never saved into a document revision.

Room labels survive conversion because the rasteriser composites real glyph outlines
(DejaVu in the container image) instead of relying on a headless font fallback.

## Export

The workspace writes an ASCII DXF sheet in the browser with `client/src/cad/`, which has no
runtime dependencies. The scene is emitted in metres (`$INSUNITS=6`, `$MEASUREMENT=1`) with one
layer per element family (`A-WALL`, `A-DOOR`, `A-WINDOW`, `A-ROOM`, `A-ANNO`, …) and a `-L<n>`
suffix per floor when every floor is drawn together, so an external editor can filter by storey.

A DWG sheet is drawn on the server instead: `POST /projects/{projectId}/exports` with
`{ "format": "dwg", "revision": <cloud revision>, "levelId" | "allLevels": true }` enqueues a
`cad.export` job, which builds the same scene, writes the same DXF and only then converts it.
The endpoint accepts `dxf` for the same scene, but the studio always uses the browser writer for
DXF so a device project needs no server at all. The client commits its draft and waits for the
cloud revision to be visible before asking, so the sheet always matches what the server holds.

## DWG is opt-in

DWG needs an external converter that keeps the LibreDWG contract `BIN -o OUTPUT INPUT`:

| Variable                    | Purpose                        |
| --------------------------- | ------------------------------ |
| `DWG_CONVERTER_PATH`        | `dwg2dxf`, enables `dwgImport` |
| `DXF_TO_DWG_CONVERTER_PATH` | `dxf2dwg`, enables `dwgExport` |

Both are probed once per path pair at startup and reported by `GET /ready` as
`dwgImport`/`dwgExport`. Blank or missing paths simply report the capability as unavailable;
requests never execute a binary that was not probed, and no path is taken from user input.
LibreDWG is GPLv3, so this repository neither vendors nor downloads it. The container installs
it only when built with `--build-arg WITH_LIBREDWG=1`:

```
docker compose build --build-arg WITH_LIBREDWG=1 && docker compose up -d
```

DWG output is R2000 and complex entities can degrade, which is why the format stays labelled
experimental in the UI and DXF remains the default export.

## Limits

Every limit is configuration, and each one is reachable as an honest failure rather than a
hang:

| Variable                 | Default  | Effect                                           |
| ------------------------ | -------- | ------------------------------------------------ |
| `CAD_MAX_BYTES`          | 33554432 | largest accepted drawing, checked before parsing |
| `CAD_MAX_ENTITIES`       | 200000   | entity budget, so nested blocks cannot explode   |
| `CAD_CONVERT_TIMEOUT_MS` | 60000    | wall clock for parse, raster and conversion      |

Conversion runs in an isolated child process with a scratch directory that is removed even on
failure, and `cad.convert` and `cad.export` jobs use `max_attempts = 1`: a hostile or malformed
drawing cannot pin a worker by being retried forever. The browser-side writer needs none of
this because it never leaves the device.
