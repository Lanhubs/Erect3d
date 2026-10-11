# API architecture

## Responsibility boundaries

`client/src/domain/types.ts` owns architectural meaning. Client domain and geometry
functions continue to own transformations, roof coverage, stairs, fences and quantity
calculations. The renderer owns meshes. This API owns identity, permissions, revisions,
assets, collaboration and review history. Gemini provides suggestions.

The API imports the canonical TypeScript types and validates their runtime structure
with Zod. The browser transport imports server contract **types only**; its bundle has
no Bun, database, storage or Gemini runtime imports.

## Modules

| Area | Responsibility |
| --- | --- |
| `config`, `middleware`, `security` | Validated settings, exact origins, CSRF, errors, rate limits, permissions and logging |
| `db`, `migrations`, `scripts` | Bun.SQL pool, ordered immutable migrations and verification |
| `projects`, `versions` | Canonical JSONB snapshots, incremental patches and immutable named states |
| `auth`, `users`, `teams`, `collaboration` | Identity, hashed opaque sessions and personal/team permissions |
| `assets`, `storage` | Private upload authorization, verification, source metadata and signed downloads |
| `jobs`, `workers`, `ai`, `plan-analysis` | Durable processing and reviewed cloud interpretation |
| `realtime` | Authenticated channels, database notifications, resume, presence and short locks |
| `comments`, `issues`, `approvals` | Architectural review, lifecycle rules and append-only decisions |
| `shares`, `presentations` | Revocable scoped links and saved presentation data |
| `components`, `quantities`, `exports`, `audit` | Scoped materials/components, estimates, actual JSON exports and history |

## Database

Business records are relational. Geometry remains a canonical document, not hundreds
of unrelated wall tables. Foreign keys, uniqueness, check constraints and indexes
enforce identity, revision order, job states, scopes and immutable history.

Snapshots store schema version, project, revision, JSONB document, timestamp and checksum.
Operations store stable IDs, actors, base/new revisions, bounded changes and request hashes.
Versions reference immutable revisions. A restore appends `document.restore` at a **new**
revision and snapshot. Operations, snapshots, versions, approvals and audit records reject
updates/deletes through database triggers.

Source records link original private files and selected rasters to canonical source IDs.
Jobs store attempt counts, availability, leases, failures and results. Analyses retain
model/prompt/schema provenance, source hash, individual pass caches, review decisions and
accepted revision. `ai_calls` records actual provider usage when returned.

Collaboration outbox rows are durable. PostgreSQL NOTIFY contains an event ID only.
Presence and connection leases are TTL records; expired records are removed. Share,
invitation, session and CSRF credentials are stored as hashes. Raw invitation credentials
are returned only on initial creation, never saved in idempotency responses.

## Editing contract

The client previews a drag locally, runs its existing domain mutation and diffs the
before/after documents at commit. Submit dependent wall, opening, roof or stair changes
together. Persist no animation frames or camera motion.

```json
{
  "operationId": "edit_unique-id",
  "baseRevision": 24,
  "type": "document.patch",
  "entityId": "wall_existing-id",
  "payload": {
    "changes": [{
      "action": "put",
      "path": ["buildings", "building_id", "levels", "level_id", "walls", "wall_existing-id", "height"],
      "value": 3.2
    }]
  }
}
```

Paths use entity IDs, not unstable array offsets. Unsafe prototype paths and identity
changes are rejected. The server locks the project, authorizes the actor, checks revision
and entity locks, applies changes, validates the whole resulting document and commits
the operation, new revision and outbox event in one transaction. Locked levels require
a separate unlock operation before geometry changes.

The same operation ID and identical request is safely replayable. Different content or
actors using that ID receive 409. Stale base revisions receive 409 with the latest revision;
there is no automatic merge or custom CRDT. Keep pending edits locally, fetch newer changes
and ask the user to resolve conflicts before replaying a rebased edit.

HTTP bodies are limited to 2 MiB. Canonical document growth across incremental edits is
also bounded by `MAX_PROJECT_BYTES` (32 MiB by default, configurable up to 128 MiB).
Image/PDF upload capacity is separate. History pages are bounded by count and payload
bytes; slow WebSocket peers are closed before buffers grow without bound.

Snapshots occur every 50 operations by default, after five minutes at the next edit, and
on explicit version creation. Envelope revision/schema/checksum remain outside `Project`.
Document schema 0 is normalized through the existing client migration; schema 1 is the
current validated format. Newer unsupported schemas fail explicitly.

## Permissions and sessions

| Role | Actions |
| --- | --- |
| OWNER | Read, edit, review, approve, manage |
| EDITOR | Read, edit, review |
| REVIEWER | Read, review |
| CLIENT | Read, review; approve only if project setting permits |
| VIEWER | Read |

Personal project owners have OWNER permission. Team owners manage all their team's
projects; the creator of a team project receives their membership role. Direct project
membership can grant scoped external access. Removing a team member also removes their
direct memberships in that team's projects. Permission removal is checked on subsequent
HTTP requests, WebSocket messages, delivery and heartbeat.

Browser cookies are opaque, HttpOnly, SameSite=Lax, Secure in production, with idle and
absolute expiry. Mutations require an exact allowed Origin and session-bound CSRF token.
Registration/login have separate rate limits and progressive login cooldowns. Password
change verifies the current password and revokes sessions. Protected reads return 404
for foreign projects, limiting IDOR disclosure.

## Private assets and failure behavior

Signed PUTs target staging keys and expire after five minutes. Finalization reads actual
size and bytes, verifies magic and decoding, then writes validated bytes to a fresh private
key that the original PUT cannot overwrite. Download URLs expire after two minutes.
Unfinalized staging objects receive durable cleanup jobs. Images are normalized upright
with thumbnails; original PDFs remain separate from selected-page rasters.

Workers claim with SKIP LOCKED, renew leases and publish only while their lease is valid.
Transient provider/network failures retry with bounded backoff; permanent invalid output
fails immediately. Cancelling prevents late AI publication. Completed AI passes are cached
across retries. Expired leases can be reclaimed; stale workers cannot fail a replacement's
analysis. A worker process handles one job at a time; scale with additional processes.

Missing Gemini leaves ordinary editing functional. Missing storage in development disables
asset routes; production requires storage readiness. Redis-backed protection fails closed
if Redis is unavailable. PostgreSQL rate limiting is a supported deployment choice, not
a silent Redis failover. WebSocket loss is recovered from persisted revisions, not presence.

Structured logs redact sensitive fields and do not include raw SQL, plans or prompts.
`TelemetrySink` supports requests, job duration/status and active connection counts without
binding the app to a monitoring vendor. Configure an exporter in `createServices` when needed.
