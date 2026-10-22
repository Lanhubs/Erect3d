# Design assistant and coordinated controls

## Setup

Run `bun run migrate` in `api` against the intended database before starting the
updated API and worker. Migration `011_assistant.sql` is additive: private threads,
messages, runs/proposals and recipient-scoped realtime events. It does not change
project documents or source files. Back up the database using the existing VPS
procedure before any production migration.

Use the existing `GEMINI_API_KEY`. Optional `GEMINI_MODEL_AGENT` overrides
`GEMINI_MODEL_PLAN` for editing only. Existing `AI_TIMEOUT_MS`, `AI_DAILY_LIMIT`,
project size limits, permissions and entity locks apply. Start the existing worker
with `bun run worker` on the VPS. Development starts only explicitly requested
jobs; opening the requesting user's saved thread can resume its pending job.
The assistant capability is independent of R2. Attaching an original plan requires
configured private storage and is opt-in on each conversation draft.

## User flow

Assistant lives in the bottom drawing dock. Desktop chat can be moved to either
side; phones use a full-height sheet. Select an element, active floor or whole
building, describe a change, then review **Current / Proposed → Apply**.
Preview uses a transient document in the existing mounted editor and canvas.
It does not save the proposal. Apply uses one server operation and one complete
Undo checkpoint. Retrying an uncertain Apply reuses its saved operation ID.
Manual edits are blocked during adoption to prevent a race with that checkpoint.

Draft text, scope, history and proposals survive closing the chat. History is
stored per requesting user and project, with an account-scoped device cache for
offline reading. Sending/applying needs a connection; manual offline edits remain
available. Gemini sees only this building's scoped model and explicitly selected
plan references. Original images are not resized or recompressed by the assistant.

Opening Assistant, an unpinned drawer, a menu, Project tools or a review closes the
previous floating interface. Pinned desktop panels remain layout panels. Escape
closes the current interface and restores focus. Affected destructive flows use
the coordinated confirmation container instead of browser-native confirmations.

## API and validation

All routes require normal project permissions; another collaborator cannot read
or apply the requesting user's private run.

| Route under `/api/v1/projects/:projectId/assistant` | Purpose |
| --- | --- |
| `GET /thread?cursor=…` | Last 30 messages, pagination, current saved run |
| `POST /messages` | Idempotent prompt, scope, base revision, optional references |
| `GET /runs/:runId` | Reconnect recovery, including stale state |
| `POST /runs/:runId/cancel` | Cancel work or discard an unapplied proposal |
| `POST /runs/:runId/apply` | Atomically validate revision/permissions/locks and commit |

Gemini receives typed inspect/find/schema/edit/validate tools. Complete SDK model
content, function call IDs and thought signatures are retained through rounds.
Tools modify a working copy, never execute scripts or arbitrary paths. Requests
are limited to three Gemini responses, twelve calls, the configured deadline and
one final validation repair. Selection scopes restrict writes; individual linked
storeys must detach before editing. Existing IDs and references remain stable.
Floor-level roof changes update visible sections as well as roof settings.

Proposal checks include schemas, geometry, system validation, locked floors,
changed polygon validity, slab openings, connected stair clearance and document
size. Apply rechecks the current revision and live collaboration locks using the
existing transaction path. Any revision change requires a regenerated proposal.
One quota row is recorded per accepted request, including idempotent retries.
Progress/completion events target only the requesting account. The client recovers
saved state on reconnect and does not run an assistant polling interval.

## Verification (22 October 2026)

Automated checks use an isolated local PostgreSQL database. An audit proved the
historical checksum mismatch came solely from Git's LF/CRLF conversion. The
migrator now accepts those equivalent line endings while still rejecting SQL
content changes; existing migration checksums remain unchanged. Additive migration
011 was also applied to the local development database after that check.

- Semantic tests cover a selected door, named room/materials, roofs, furniture,
  connected stairs/upper opening, locks, invalid polygons, atomic tool rollback
  and one linked tower storey's detachment.
- API tests cover private history, private WebSocket recipients across API
  instances, idempotency/quota, stale proposals, permissions, cancellation,
  clarification, limits, timeout, Apply replay and save/reopen.
- Client tests cover overlay ownership and the edit lock/complete Undo checkpoint.
- The live roof check used the authored Willow Court House, with no private file or
  R2 upload. It prepared the validated visible flat-roof change in 7.6 seconds,
  three responses and four tool calls. This is one measured example, not a latency
  guarantee. Browser interaction checks used a deterministic provider separately.
- Additional live requests against authored house, furnished-house, hall and
  tower fixtures produced validated proposals for a selected glazed metal door,
  Dining room marble finish, in-place sofa rotation, a connected stair and upper
  slab opening, and detaching/renaming one linked storey. Early furniture/stair
  runs exhausted the three-response budget. Returning geometry and schemas
  together and accepting unchanged identity fields fixed those tested cases;
  changed IDs and locks remain prohibited. Evidence is saved in
  `api/.local/assistant-live-{matrix,recheck,furniture}.json`.
- Actual editor captures are in `.local/screenshots/assistant-*.png` at repository
  root. Preview retained one canvas. Desktop viewport controls align below the
  file header; browser checks cover desktop, tablet and phone interaction.
  The recorded camera coordinates matched exactly across Current/Proposed.

## Final local state

The final full suites passed 230 client tests and 165 backend tests, with the
optional Redis test skipped. The added migration line-ending regression check
also passed. Client production build, API/worker bundles, type checks and the API
200-line source gate passed. The regular local development API reports Assistant,
private storage, reconstruction and realtime ready; the frontend is available at
`http://127.0.0.1:5173/projects`. The isolated deterministic review services were
stopped after capturing screenshots so they cannot be mistaken for the real API.

## Limits still visible to users

The assistant edits existing model capabilities; it does not certify engineering
or building-code compliance, run arbitrary modeling code, animate lifts, create
new furniture assets or guarantee a perfect design from every prompt. Complex
requests may need smaller follow-ups; ambiguity and invalid proposals remain
unapplied. Only the latest sixteen messages are sent as conversational context;
older history remains paginated and readable. Provider latency/network failures
can still occur. Review is always required before Apply.

The existing native WebGPU tower startup defect is a separate open graphics
issue. These browser interaction checks use the explicit compatibility renderer
and do not claim to resolve that defect. Nothing is pushed or deployed.
