# Testing cloud projects

Start the API from `api/` with its development database configuration, then start this
client with `bun run dev`. Open `/cloud`. Development exposes the cloud entry point;
local projects keep their existing database and editor workflow.

If port 4000 is occupied, set `ERECT_API_PROXY=http://127.0.0.1:4001` when starting Vite.
The current local QA session uses that proxy. This is a development server setting;
storage and provider credentials remain in the API's ignored environment file.

If port 4000 is occupied, set `ERECT_API_PROXY=http://127.0.0.1:4001` when starting Vite.
The current local QA session uses that proxy. This is a development server setting;
storage and provider credentials remain in the API's ignored environment file.

For a production VPS build, set `VITE_ENABLE_CLOUD=true` before `bun run build`. Leave
`VITE_API_ORIGIN` empty when Nginx serves the frontend and proxies `/api` to the API on
the same HTTPS origin. The configured API allowed origin must match exactly.
`VITE_PUBLIC_REGISTRATION=true` exposes registration in the production client, but the
server must also explicitly enable `PUBLIC_REGISTRATION=true`. Keep both closed until
staging has been verified. No storage or Gemini secret belongs in a `VITE_` variable.

## Workflow

1. Sign in and create a cloud project, or explicitly copy a local project to cloud.
2. Open it in the existing editor. The status bar reports server revision and sync state.
3. Edits are durably queued in a separate account-scoped browser database. Network retries
   replay the same operation ID/body, including after an accepted response is lost.
4. Conflicting edits retain the full device draft for explicit comparison and rebase.
   Only one tab edits a given project; other tabs observe and can take over when it closes.
5. Import a plan normally. Source bytes initially stay cached on this device. Use Cloud
   tools to optimize and upload privately when storage is configured. Lossless compression
   retains original dimensions/detail and reports prepared versus stored bytes. R2 is the
   production store; the filesystem driver supports isolated local checks.
6. In Plan and proposals, backend AI reads the source directly by default. Browser measurements
   are bypassed. Choose fresh reconstruction to replace the target floor after explicit
   review, or enhancement to preserve its existing IDs/design choices. Original PDFs and
   selected page rasters are sent together. Give cloud consent before requesting analysis.
   The optional hybrid engine can use explicitly measured OpenCV evidence.
7. Review each candidate and its uncertainty. Edit/reclassify it before accepting. Choose
   door styles/hosts and stair destinations explicitly. Acceptance uses normal editor
   entities and stable correction IDs. Confirmed properties need separate approval; stale
   targets are rejected. Select design alternatives explicitly and compare current/proposed
   3D before accepting. Interpretation preserves roof choices; selected designs update them.
   Acceptance supports undo/redo after snapshot recovery. A fresh review applies new settings.
   Optional removals start unchecked and show source evidence. Removing a wall requires
   explicitly reviewing its hosted openings or reassigning them; confirmed properties need
   approval and stale targets are blocked. Rooms with assigned objects require reassignment.
   Backend 3D previews come from the server compiler. Fresh reconstruction needs the floor
   replacement checkbox before acceptance; it preserves other floors and roof choices.
   See [backend workflow](../api/docs/BACKEND_RECONSTRUCTION.md).

HTTPS and Web Locks support are required. An authenticated open tab supports offline drafts;
a new offline page cannot establish an authenticated session. Clearing browser storage
removes its unacknowledged queue, so export important device drafts before clearing it.

Real Gemini integration was verified with a generated synthetic plan through browser review,
3D comparison, acceptance, undo/redo and persisted reload. Accuracy on complex architectural
drawings is not yet benchmarked. Real R2 CORS and VPS recovery remain unverified. See
[hybrid delivery scope](../api/docs/HYBRID_INTERPRETATION.md) for remaining advanced features.
