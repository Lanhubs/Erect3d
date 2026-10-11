# Erect 3D

Browser-based architectural reconstruction workspace. Projects store a structured building model in metres; the editable plan and Three.js viewer render that same model.

## Run

```sh
npm install
npm run dev
```

The dashboard includes editable sample buildings so the 2D → 3D → walkthrough pipeline can be inspected without a floor plan. Create a blank project and import a PNG, JPEG, or PDF floor plan. Analysis starts automatically and estimates scale from consistent door symbols or wall strokes; picking calibration points is optional. **Accept & generate 3D**, or the **3D** view button after analysis, creates the editable draft. Verify scale against a known dimension for measured work; manual calibration accepts metres, centimetres, millimetres, feet, or inches. **Reanalyze plan** lets you inspect and correct proposals before replacing the draft. Projects save locally through IndexedDB.

The **Roof design** controls offer hidden flat, gable, hip, and exposed mono-pitch forms; concrete, standing-seam aluminium, corrugated aluminium, and concrete tile coverings; plus colour, pitch, and overhang. Roof geometry follows the current walls. **Hide roof** reveals the editable interior. Existing projects use the hip roof default until a roof choice is saved.

Automatic reconstruction combines solid wall strokes, paired wall outlines and thick diagonal runs, consolidating overlapping measurements into a single wall body. Wall-jamb leaves, quarter-circle swing symbols and parallel glazing strokes support door/window proposals. Closed wall boundaries become editable spaces and floor polygons; empty margins and open courtyards are not filled by a bounding-box slab. Imported roof sections follow those polygons. Repeated treads with side rails are preserved as stair footprints for connecting to a reviewed upper floor. Compact column marks are optional, unchecked proposals.

Use **Spaces**, **Details** and the interpretation popover to inspect these proposals. This is local image interpretation, without OCR or automatic recognition of room names, curved walls, roofs or storey heights. Dense annotations can still be confused with structure and small raster drawings lose fine symbols. All generated geometry needs review; automatic scale is an estimate, and stair connections must fit the measured footprint, wall clearances and upper-floor slab. Prefer the original PDF or a larger image when available.

Before generating 3D, open **Floors & roofs** to locate each space and uncheck enclosed areas that should stay uncovered. Selecting a space highlights its outline; excluded spaces keep their walls but generate neither a floor nor a roof. Choices follow the polygon rather than its list position. Roof section settings can be expanded individually in Properties. Thin perpendicular door leaves can be proposed without a swing arc; these weaker proposals still need review. Duplicate traces of one line are not treated as window glazing.

Connected spaces share one continuous building roof, including courtyard cutouts. **Properties → Roof design** always provides form, covering, colour, pitch and overhang choices for the whole roof; independent sections are optional. Earlier automatically generated per-room roofs are repaired when a project is reopened. **Use one building roof** rebuilds the roof from the included spaces.

The site fence uses the full ground footprint. Click it in 3D or select its boundary in the plan to edit fence and gate settings; drag selected boundary points in the plan to reshape it. **Fit around building** regenerates the full perimeter using the setbacks. Manual boundary edits are preserved; automatic fences follow ground-level wall and alignment changes.

Select a door in the plan or 3D model to edit its design (flush, panel, glazed, or double leaf), hinge side, and dimensions in Properties. Reanalyze an imported plan to apply improved thick-wall detection to an existing draft. On narrow screens, selecting an element opens its Properties sheet; the toolbar remains above the main viewport.

PNG imports keep the original image for source viewing. A scaled bitmap is used for analysis. Small images are accepted, with a warning that fine details may be missed. Source files can be up to 200 MB and images up to 256 megapixels; larger drawings need a tiled image pipeline.

## Controls

- Plan: Ctrl/Cmd+scroll or Ctrl/Cmd++/− to zoom inside the plan, Ctrl/Cmd+0 to fit; middle drag or Pan to move. Click endpoints to draw a wall or move a selected endpoint.
- Rooms: click polygon vertices, then double click or choose **Close room**.
- Measure: click two points.
- 3D: drag to orbit, right drag to pan, scroll or pinch on the model to zoom, or use the on-screen +/−/Fit buttons. Ctrl/Cmd+scroll and Ctrl/Cmd++/− also zoom the camera; Ctrl/Cmd+0 fits the model. The workspace intercepts these browser zoom shortcuts while it is open.
- Walkthrough: choose **Walk**, then click the model to capture the pointer. WASD move, mouse looks, Shift moves faster, E opens/closes a nearby door, and Esc releases the pointer without moving you back to the entrance. **Exit walk** restores the previous inspection camera. **View options** provides Normal/Fast speed, entrance/current camera/selected room/saved viewpoint starts, and a subtle optional minimap. Floors, simplified stair slopes, ramps, columns, major visible furniture, and enabled fences constrain movement; open doorways remain passable.
- Undo/redo: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
- Building editing: select an element in 2D or 3D, then drag the blue centre to move or blue edge handles to reshape; purple rotates, green resizes, and amber adjusts height. Arrows nudge 0.1 m, Shift makes movement ten times finer, [ / ] rotate 5°, , / . resize, and Page Up / Down adjust height. Esc cancels a drag; one completed drag makes one undo step. Openings stay on their host walls and stairs keep their linked upper-floor opening.
- Verandas: select a door on any floor and choose **Add entrance veranda** or **Add upper-floor veranda** in Properties. Set width, projection, outside face, guardrails, floor finish and flat or single-slope cover. Verandas follow their door and are saved with the project.
- Roofs follow the actual building outlines, retain courtyards, close gaps above wall tops and omit portions covered by higher floors. Whole-roof and independent section design choices remain in Properties.

## Furniture & fixtures

Expand **Furniture & fixtures** below the source strip. Interpretation is **off by default**; enable **Interpret furniture with plan analysis** to run a separate worker pass after structural analysis, or use **Analyze furniture from source** later without re-importing or replacing the architecture. The original source remains in IndexedDB.

The local detector recognizes selected evidence patterns for beds, sofas, dining tables, cookers and sanitary fixtures. It is a bounded symbol detector, not a universal image recognition service. Unfamiliar or unclear symbols stay **Unknown / Needs review**; confidence is a heuristic score, not a measured probability. No proposal becomes a 3D object until you accept it. Source overlays distinguish accepted (green), uncertain (amber) and rejected (red); select, drag, reclassify, rotate, resize, reject or delete proposals before **Place accepted furniture** or the next **Generate 3D** action. Placement warnings flag walls, floor openings, stairs and room context without silently moving objects.

**Place furniture** also provides a manual library. Accepted objects share selection and editing between the 2D and 3D views, use the current floor elevation, persist with the project and can be duplicated, deleted, recolored or given another variant in Properties. **Furniture on/off** controls both views; hidden furniture is also excluded from walkthrough collision. Beds, upholstery, cabinets and fixtures use reusable procedural geometry and instanced batches instead of downloaded high-poly assets.

Try **Maple House · furnished walkthrough** in the sample library: a furnished two-storey home with a physically connected stair hall. Walk upstairs and return downstairs through the same route. Keyboard/pointer walkthrough requires WebGL; the software preview continues to support furniture display and editing.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the model, coordinate, geometry, rendering, analysis, persistence, and performance decisions.
