# Erect3D API

Bun + TypeScript + Hono backend for the existing editor, with PostgreSQL persistence,
private Cloudflare R2 storage, a separate worker and optional Gemini interpretation. All backend
files live here. The frontend is in `../client`; its `Project` is the canonical model.

## What is available

- Opaque browser sessions, users, personal projects, teams and project permissions.
- Canonical snapshots, incremental edits, optimistic revisions, immutable versions and restore.
- Private uploads, image normalization, selected PDF page links and JSON exports.
- Cross-instance WebSockets, presence, expiring entity locks and revision resume.
- Anchored comments, issues, immutable approvals, saved views and scoped share links.
- Durable background jobs and reviewable Gemini proposals with explicit acceptance.
- Material/component libraries and geometry-derived quantity schedules.

The browser adapter is in `client/index.ts` and is connected to the editor's unified
Projects workspace. Samples load from the API. IndexedDB caches opened projects and
pending edits for offline work, then syncs automatically when connectivity returns.

## Development

Verified locally with Bun 1.4.2 and PostgreSQL 17. Install both frontend and API
dependencies, because shared pure geometry imports remain in the frontend source tree.

```sh
cd client
bun install --frozen-lockfile
cd ../api
bun install --frozen-lockfile
```

Copy `.env.example` to an ignored `.env.local`. Set `DATABASE_URL` to your development
database. Leave cloud credentials empty to test accounts, projects and collaboration;
asset and AI routes then return an explicit unavailable error.

For local account creation, set `NODE_ENV=development` and
`PUBLIC_REGISTRATION=true` in the API env file. Restart the API after changing env
settings. An explicit `PUBLIC_REGISTRATION=false` disables sign-up in every mode;
production also disables sign-up unless explicitly enabled.
For the frontend production preview, also set `VITE_PUBLIC_REGISTRATION=true` in
`client/.env.local` and rebuild; the Vite development server shows signup automatically.

Optional Docker services, from the repository root:

```sh
docker compose up -d postgres
```

Development uses `postgres://erect_dev:local-development-only@127.0.0.1:55432/erect_dev`;
the separate disposable test database is `erect_api_test` on the same local service.
These credentials are for local development only. Add Redis with
`docker compose --profile redis up -d redis` on port 56379. PostgreSQL rate limiting
works without Redis. See the root README to run the API and worker in Compose too.

```sh
# Run from api/
bun --env-file=.env.local run migrate
bun --env-file=.env.local run dev
# Separate terminal:
bun --env-file=.env.local run worker
```

`GET /health` checks the process. `GET /ready` checks the database and configured storage
and rate-limit dependencies. The default API address is `http://127.0.0.1:4000`.
Development origins default to both localhost and 127.0.0.1 on port 5173; add the exact
origin if your frontend uses a different port. No wildcards or origin paths are accepted.

## Verification

Use a disposable database ending in `_test`; never point tests at live project data.
Create an ignored `.env.test` containing `TEST_DATABASE_URL` and `DATABASE_URL` for that
database. Run migrations against it first. Tests use real PostgreSQL, fake AI and an
in-memory object adapter; they do not spend Gemini quota.

```sh
bun --env-file=.env.test run migrate
bun run verify
bun --env-file=.env.local run check:startup
bun build ./client/index.ts --target browser --outfile .local/browser-adapter.js
```

`TEST_REDIS_URL` enables the additional native Redis integration test. See
the root `.github/workflows/ci.yml` for active PostgreSQL/Redis CI checks.

Real cloud checks are separate, operator-invoked commands:

```sh
bun --env-file=.env.local run check:storage
# Add LIVE_STORAGE_ORIGIN=https://erect3d.olanrewaju.xyz to check signed GET CORS.
# Consumes provider quota; explicit opt-in is required:
LIVE_GEMINI_CONFIRM=yes bun --env-file=.env.local run check:ai
```

The storage check writes and deletes a random private test object. Bucket CORS also
needs to allow your exact frontend origin for browser PUT/GET requests.

## Documentation

- [Client inspection](docs/CLIENT_CONTRACTS.md)
- [Architecture and persistence](docs/ARCHITECTURE.md)
- [Registered endpoint inventory](docs/ENDPOINTS.md)
- [WebSocket protocol](docs/REALTIME.md)
- [VPS deployment and operations](docs/VPS.md)
- [Private R2 storage and file optimization](docs/R2_STORAGE.md)
- [Hybrid interpretation scope and accuracy gates](docs/HYBRID_INTERPRETATION.md)
- [Delivery report, verification and limitations](docs/DELIVERY.md)

Authenticated OpenAPI is available at `/api/v1/openapi.json`. Routes are derived from
Hono registration and core request schemas from Zod. Some auxiliary bodies and response
schemas remain generic; this is not yet a complete client code-generation specification.

Nothing has been committed, pushed or deployed by this backend task.
