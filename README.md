# Erect 3D

Browser-based architectural reconstruction workspace. Projects store a structured building model in metres; the editable plan and Three.js viewer render that same model.

## Run

```sh
npm install
npm run dev
```

The dashboard includes a sample building so the 2D → 3D → walkthrough pipeline can be inspected without a floor plan. Create a blank project and import a PNG, JPEG, or PDF floor plan. Set scale by clicking two points on a known dimension; the calibration input accepts metres, centimetres, millimetres, feet, or inches. **Apply scale & generate 3D** analyzes the image, creates editable wall geometry, and opens the 3D draft. Use **Edit walls** to correct detection errors and add doors, windows, and rooms. **Reanalyze plan** lets you review dashed wall candidates before replacing the draft. Projects save locally through IndexedDB.

The **Roof design** controls offer hidden flat, gable, hip, and exposed mono-pitch forms; concrete, standing-seam aluminium, corrugated aluminium, and concrete tile coverings; plus colour, pitch, and overhang. Roof geometry follows the current walls. **Hide roof** reveals the editable interior. Existing projects use the hip roof default until a roof choice is saved.

Automatic reconstruction detects straight wall runs and suggests doors or windows for some gaps. All suggestions need review; rooms, furniture, roofs, and stairs need manual placement. The draft is an aid to tracing, not a finished architectural model.

Select a door in the plan or 3D model to edit its design (flush, panel, glazed, or double leaf), hinge side, and dimensions in Properties. Reanalyze an imported plan to apply improved thick-wall detection to an existing draft. On narrow screens, selecting an element opens its Properties sheet; the toolbar remains above the main viewport.

PNG imports keep the original image for source viewing. A scaled bitmap is used for analysis. Small images are accepted, with a warning that fine details may be missed. Source files can be up to 200 MB and images up to 256 megapixels; larger drawings need a tiled image pipeline.

## Controls

- Plan: Ctrl/Cmd+scroll or Ctrl/Cmd++/− to zoom inside the plan, Ctrl/Cmd+0 to fit; middle drag or Pan to move. Click endpoints to draw a wall or move a selected endpoint.
- Rooms: click polygon vertices, then double click or choose **Close room**.
- Measure: click two points.
- 3D: drag to orbit, right drag to pan, scroll or pinch on the model to zoom, or use the on-screen +/−/Fit buttons. Ctrl/Cmd+scroll and Ctrl/Cmd++/− also zoom the camera; Ctrl/Cmd+0 fits the model. The workspace intercepts these browser zoom shortcuts while it is open.
- Walkthrough: click **Enter walkthrough**, use WASD and mouse; Esc releases the pointer.
- Undo/redo: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the model, coordinate, geometry, rendering, analysis, persistence, and performance decisions.
