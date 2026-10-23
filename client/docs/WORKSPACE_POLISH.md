# Workspace polish and standalone film

## Controls and behavior

- **Collaborate** in the file header opens the existing people/access panel directly. Existing roles, discussion and reservations remain in place.
- **Present** is visible beside the desktop/tablet view controls; phones retain **Present building** in More.
- Furniture and secondary actions use flat bronze/neutral treatments. Warning colors and model/editing colors are preserved.
- Login and New project use quiet filled fields with a bronze focus border; keyboard focus remains visible.
- Assistant uses one history scroller and an anchored composer. Its empty introduction fits desktop and phone layouts without a redundant scrollbar.
- Shared loading UI covers project loading, session checking and actual renderer preparation. Reduced-motion settings and renderer recovery remain supported.
- Menus/popovers close after a 200ms mouse-exit grace period. Trigger-to-popup movement, keyboard editing and touch do not cause accidental dismissal. Grid & snap uses the same overlay coordinator as the other floating controls.
- Forms, Assistant, confirmations and panels require explicit dismissal. Assistant drafts survive closing; Escape restores trigger focus.
- Confirmations name the action and item, initially focus Cancel, prevent double submission and retain asynchronous errors for retry. Existing string-based confirmation callers remain compatible.

## Fence correction

Automatic fitting uses the complete above-ground envelope: walls, slabs, rooms, columns, connected stairs, ramps, verandas and architectural systems. Source-image margins and furniture do not affect it. Zero setbacks allow for the physical fence thickness. Generation, reconstruction repair and editing use this shared calculation.

Manual boundaries remain editable and are never automatically replaced. Intersections produce a warning with the existing **Fit around building** action. Automatic fitting preserves enabled state, finishes, segment/gate identities and remains in the building edit's Undo checkpoint.

## Film package and builds

The reviewed implementation, fonts, tests and tooling live in root-level `motion-video`, alongside `client` and `api`. Superseded film sources were retained only in the ignored local recovery folder. The editor imports no film implementation. Its development proxy and combined production build preserve `/motion/erect3d-film/`.

Install dependencies in both packages. `bun run build` from `client` builds the editor and independent film site and mounts the film under `client/dist/motion/erect3d-film/`. Film assets are excluded from editor offline caching. Independent commands and video export instructions are in `motion-video/README.md`.

The delivered local video is `motion-video/output/erect3d-film.mp4`: 35 seconds, 1050 frames, 1920×1080, 30fps, H.264 CRF 18, yuv420p, no audio, fast-start playback. The real browser composition includes the HTML/SVG overlays. Generated video, frames and build output are ignored by Git.

## Verification — 23 October 2026

- Full client suite: 239 passed. Focused fence/confirmation suite: 15 passed. Film: 2 passed, 3179 assertions. Client/film production builds and API type checking passed; existing large-chunk warnings remain.
- Actual browser checks: login; New project bronze focus and no outline; delete cancellation with Cancel focused; direct collaboration; Assistant-to-panel exclusivity; empty Assistant scrolling; draft preservation; Escape focus; furniture placement followed by Undo; presentation and exit; mouse-exit dismissal; single mounted 3D canvas; desktop/tablet/phone layouts without horizontal overflow.
- Responsive checks used 1366×768, 1024×768 and 390×844. Desktop docks did not overlap. Assistant fit its phone sheet without redundant scrolling.
- A cold Split-view check exposed a redundant direct renderer resize that cleared the last demand frame. Resizing now goes through the existing R3F owner and invalidates the view. Cold Split visibly renders without navigation. Repeated 2D/Split/3D/Present transitions retained the same renderer ID, camera, preparation timing and shadow invalidation count; evidence is in `.local/polish/viewport-lifecycle.json`.
- The MP4 passed complete decode and atom-order checks: 1050 decoded frames, 35 seconds, 1920×1080, 30fps, H.264, yuv420p and moov before mdat. Browser playback reached 35 seconds with `ended=true` and no media error. Review frames were extracted from the encoded file itself.
- Browser screenshots are saved in `.local/polish/`; decoded video stills in `.local/film-review/`; export verification in `motion-video/output/verification.json`.
- Backend integration blocker: the configured test database rejects authentication for `erect_test`. Full backend run: 110 passed, 1 skipped, 22 failed through `RATE_LIMIT_UNAVAILABLE`; a read-only diagnostic identified the database authentication failure. No database password, schema or migration was changed. The separate local development API worked for the review account and sample project.
- Native WebGPU startup remains a separate open graphics issue. Editor visual checks used the existing explicit Compatibility renderer. No rendering quality or geometry was reduced for navigation.

No deployment or push was performed. No Gemini calls or private-plan uploads were needed.
