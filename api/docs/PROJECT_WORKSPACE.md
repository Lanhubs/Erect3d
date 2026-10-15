# Projects, backend templates and offline editing

The application has one Projects workspace at `/projects`. Models live in the
authenticated backend. `/cloud` and `/cloud/:id` remain compatible aliases for older
links, without separate storage modes in the interface.

## Templates

`GET /api/v1/templates` returns the nine existing editable architectural samples from
the backend catalogue. The dashboard keeps this response in memory; it never populates
an IndexedDB template library or falls back to locally generated samples.

`POST /api/v1/templates/:templateId/projects` creates a private project from the
server-owned template. Its strict body is `{ duplicate: boolean }`. An Idempotency-Key
is required, so retrying a lost response creates one project. Template geometry cannot
be replaced by the client. Samples retain their existing floors, stairs, furniture,
stadium stands and roofs. Project snapshots and normal editing use the same contracts.

New blank projects use the existing authenticated project creation endpoint. A first
template instantiation or new project needs a connection. Already opened projects can
be edited offline. Previous device drafts remain intact; **Recover previous device
drafts** copies a selected draft into the account and preserves its source files.

## Offline working copy and sync

IndexedDB stores account-scoped working documents, source blobs and immutable pending
operation IDs/bodies. It is an offline cache and durable edit queue, not the project or
template authority. Clean opened documents stay cached so an unexpected disconnection
does not prevent editing. Sign-out hides that account's drafts; another account cannot
open them through its project list. Last-account identity is cached without passwords,
session cookies or CSRF tokens. Offline identity grants no server authorization.

The production build emits `/offline-worker.js`, which caches the public app shell and
bundled editor assets. API responses, source download URLs, private assets and third-party
requests bypass the service worker. Private source blobs use the account-scoped IndexedDB
cache. HTTPS (or localhost) and Web Locks are required. **Offline ready** indicates the
shell is installed; service worker updates wait for existing controlled tabs to close.

Network errors and unavailable gateways retain the draft and operation. On reconnect,
the online event, realtime reconnect and periodic refresh retry saves automatically.
The same operation ID/body is replayed before loading a newer snapshot, avoiding
duplicate edits when a response was lost. Two tabs cannot write the same project at once.

A confirmed revision conflict safely merges independent changes onto the latest
snapshot with a new operation ID. Identical already-applied changes are skipped.
Overlapping edits keep the full draft and require **Review conflict**. Entity locks,
permission failures and invalid geometry are not treated as ordinary revision conflicts.
Large operations retain the existing 512-change / 2 MiB transaction limits; oversized
drafts remain recoverable through JSON export and need smaller edits before syncing.

Imported plan metadata syncs first. Missing source files then upload automatically to
private backend storage using the existing lossless optimization and stable upload keys.
Provider consent is still required for AI analysis; syncing a drawing does not send it
to Gemini. R2 access must be configured successfully on the VPS.

## Verification

- All nine backend templates instantiate schema-valid models with geometry validation.
- Private ownership, duplicate copies, idempotent retries and forged template bodies are tested.
- Offline queue recovery, lost responses, overlapping edits, independent merges, entity locks,
  account identity isolation and unavailable gateway handling are tested.
- Browser verification created Willow Court House from the API, edited its roof with both
  frontend and API servers stopped, reloaded the cached editor, then automatically synced
  to revision 2 after the servers returned without pressing Retry.
- A separate blank QA project verifies automatic private source-file upload after import;
  AI analysis remains a separate opt-in action.
- API: 74 passed, one Redis skip, zero failed. Client: 158 passed, zero failed.
  Typecheck, source length gate and production build passed.

No deployment or push was performed. Real R2 transfers remain blocked by its existing
AccessDenied credentials; local verification uses the private filesystem adapter.
