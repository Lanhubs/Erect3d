# Collaboration protocol

Connect using the session cookie to:

`/api/v1/realtime/projects/:projectId?afterRevision=24`

The handshake checks the exact Origin and project membership. A database-backed lease
limits each user to eight active connections across API instances. Connection attempts
and messages are rate limited. Text frames are bounded to 512 KiB, Zod validated, and
processed in order with at most ten queued messages per connection.

## Client messages

| Type | Fields | Meaning |
| --- | --- | --- |
| `operation.apply` | `operation` | Same persistent edit contract as HTTP |
| `presence.update` | `presence` | Cursor, camera, selection, activeLevelId, editingEntityId, typing |
| `lock.acquire` | `entityId` | Acquire/renew a 30-second lock on an existing entity |
| `lock.release` | `entityId` | Release this connection's lock |
| `resume` | `afterRevision` | Request later persisted operations |
| `pong` | none | Reply to application heartbeat |

Camera presence uses `{x,y,z,yaw,pitch}`; cursor uses canonical `{x,z}` metres. Presence
is optional, transient and expires after 30 seconds. It never advances project revision.
Throttle pointer/camera presence locally; do not send every render frame.

## Server messages

- `connected`: connectionId and authenticated userId.
- `resume`: ordered operations, currentRevision, nextRevision and hasMore.
- `operation.ack`: operationId and authoritative revision.
- `operation.accepted`: eventId and accepted operation in payload.
- `revision.created`, `revision.restored`: named version/restore notifications.
- `comment.created`, `comment.updated`, `issue.updated`, `approval.created`: review notifications.
- `lock.acquired`, `lock.released`: entity lock state.
- `presence.update`: userId, connectionId and presence.
- `ping`: time; answer with `{ "type": "pong" }`.
- `error`: bounded code, message and correlation requestId. Authorization failure closes the connection.

Persistent event notifications are fetched from an outbox after PostgreSQL NOTIFY.
Notify payloads contain IDs, not architectural documents. Two separate API processes
and their native Bun.SQL listeners were exercised against PostgreSQL in integration tests.
Recent outbox events are replayed after listener recovery and periodically checked.
Event IDs should be deduplicated by the client.

## Resume and conflict handling

Resume batches contain at most 200 operations and approximately 2 MiB of payload. Continue from nextRevision while hasMore.
If state is too old or a restore event occurs, load the current canonical snapshot instead.
Keep the last fully applied authoritative revision locally. Treat operation acknowledgments
and broadcasts as the same edit, deduplicating by operationId.

Stale revisions are rejected, even for edits to different entities. The client should
keep unacknowledged changes in IndexedDB, load newer state and resolve/rebase explicitly.
Entity locks supplement revision checks; they are not a transaction or a permanent claim.
Renew during an active drag and release after commit/cancel. Closing the connection removes
its locks; TTL cleanup handles crashes.

Application heartbeats run every 15 seconds. Connections without messages for 45 seconds
are closed. Native control pings are also enabled. Every incoming message and outgoing
project delivery rechecks session and membership; revoked accounts cannot keep a channel
by retaining an old handshake.

## Current bounds

Resume is by project revision; there is no separate review-event cursor. Fetch comments,
issues and approvals again after reconnect. No CRDT or automatic offline conflict merging
is implemented. Very large history batches should use HTTP/snapshot reload rather than
unbounded WebSocket buffering. Large deployment fan-out and slow-client load testing remain
deployment gates before claiming a tested concurrency capacity.
