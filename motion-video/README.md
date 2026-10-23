# Erect3D — From plan to place

Independent 35-second browser film, separated from the editor.

## Build and export

From `motion-video`:

- `bun install --frozen-lockfile`
- `bun run dev` — review on http://127.0.0.1:5191/motion/erect3d-film/
- `bun test` and `bun run typecheck`
- `bun run build` — standalone site in `dist/`
- `bun run preview` — production review on port 5192
- `bun scripts/capture-film.mjs --url http://127.0.0.1:5192/motion/erect3d-film/ --out output/frames --frames all`
- `bun run export:video -- --ffmpeg <path-to-ffmpeg>` — writes `output/erect3d-film.mp4`

The encoder is an external local tool, not a production dependency. Output is 35 seconds, 1050 frames, 1920×1080, 30fps, H.264 CRF 18, yuv420p, silent, with fast-start playback. `FFMPEG_PATH` is also supported.

The editor development server proxies the original film URL to port 5191. Its production build also builds this package and copies the standalone site to `client/dist/motion/erect3d-film/`. Nginx serves that directory before the editor fallback. Film assets are excluded from the editor service worker. Install both packages before a combined build. No account, backend, private drawing, project mutation or AI request is involved.

## Direction and source

Eight timed scenes follow the supplied script: identity 0–3s; drawing 3–8s;
understanding 8–12s; erection 12–19s; realism 19–24s; editability 24–28s;
walkthrough 28–32s; end hold 32–35s. The physical model grows directly from the
same plan coordinates. There are no generated architectural images or screenshot
crossfades in the erection sequence.

The existing favicon is the actual logo; bronze #b17b43, dark #2c3531, warm
#f3f0ea and DM Sans / IBM Plex Mono come from the client. The film bundles those
fonts locally, with OFL licenses alongside them. It does not invent a wordmark.

Maple House is an isolated authored sample with stable IDs. Film-only additions
(front windows, timber screens and guarded entrance balcony) use real editable
model fields. Walls use the editor's wall-solids/opening geometry and wall
textures; windows, doors, floors, stair, veranda, furniture and roofs reuse the
actual rendering components. A hosted window widens from 1.60 to 2.40 metres in
both plan and model; eleven variants are prepared once, rather than rebuilding
geometry each animation frame. DoorMesh has an optional absolute pose for film
capture; ordinary editor behavior remains the default.

## Playback and deterministic capture

- `?autoplay=false` opens paused with Play/Pause, Restart, timestamp, scrubber and
  scene selector outside the composition.
- `?capture=true&t=21` opens paused at 21 seconds. Capture mode has no controls and
  fixes the virtual composition and canvas buffer to **1920 × 1080**, DPR 1.
- Wait for `.film-root[data-ready="true"]` before capturing. Preparation includes
  the logo, local fonts, vector drawing, environment and shader compilation.
- `window.erectFilm` exposes `duration`, `fps`, `play()`, `pause()` and asynchronous
  `seek(seconds)`. Await `seek` before taking a frame; it waits for the canvas and
  HTML overlays to agree on the timestamp. Scrubbing is absolute and reversible.
- For 30fps export capture frames 0…1049 at `frame / 30` seconds with a 1920×1080
  browser viewport. Save the entire composition, including HTML/SVG typography.
  A canvas-only export omits typography and labels.
- Encode an existing PNG sequence with, for example:
  `ffmpeg -framerate 30 -i frame-%04d.png -c:v libx264 -pix_fmt yuv420p erect3d-film.mp4`.
  The film itself adds no encoder dependency and does not synthesize audio.

The same timestamp produces the same camera, geometry poses, plan, edit step,
materials and copy on the same renderer. Pixel equality across different GPU
vendors is not promised. The film deliberately uses the established WebGL path;
it does not depend on the unresolved native WebGPU tower startup issue.
Rendering stops when paused. Preview scales the fixed virtual composition to
available space; capture retains the fixed output resolution.

## Structure and review

`config.ts` defines frame settings and scene boundaries; `motion.ts` has pure
curves; `timeline.ts` owns playback and camera interpolation; `model.ts` owns the
isolated model and plan; scene, overlay and playback UI modules remain separate.
No new animation dependency was introduced. The master time drives every visible
change; no CSS keyframe clock, random effects, physics or live API affects frames.

Tests cover all 1051 inclusive timeline samples, seek-order independence, valid
project geometry, connected stairs and the window/plan edit correspondence.
Review the whole 35 seconds and inspect 1.8, 6, 10, 14, 17, 21, 26, 30.8 and 34
seconds when adjusting direction. Review stills live in `.local/film/` at the repository root; encoded output lives in this package’s ignored `output/` directory. The horizontal film is the delivered composition; a later 9:16
version should recompose the side copy and edit inset rather than crop them away.

Verification: the film’s two tests cover 3179 assertions. Production build passed with the existing
large-chunk warnings. Browser review confirmed a 1920×1080 drawing buffer and
composition, and identical full-frame bytes when returning to the same timestamp.
The standalone browser timeline is also encoded as `output/erect3d-film.mp4`. Generated builds, frames and video remain outside source control.

