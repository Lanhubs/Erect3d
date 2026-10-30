# VPS deployment and operations

The deployment target is your VPS. No Vercel workflow is assumed. These are deployment
templates, not a claim that a server has already been provisioned or deployed.

## Layout and prerequisites

Use a Linux VPS with Bun 1.4.2, PostgreSQL 17, Nginx and TLS certificates. Keep PostgreSQL
and the API private to the server/network. If using native Redis protection, use Redis
7.2 or newer with authentication and private networking. PostgreSQL protection is also
supported. Use private Cloudflare R2 storage with public reads disabled. Original files
use reversible ZIP storage; image pixels and PDF contents are not rewritten.

Deploy the repository as `/opt/erect3d`, keeping `api/`, `client/` and `motion-video/`.
API imports use pure client geometry at runtime. Install pinned dependencies in each
directory and build the frontend into `client/dist`:

```sh
cd /opt/erect3d/motion-video
bun install --frozen-lockfile
cd ../client
bun install --frozen-lockfile
bun run build
cd ../api
bun install --frozen-lockfile
```

The client build also builds the independent film and mounts it at
`client/dist/motion/erect3d-film/`. The supplied Nginx configuration serves that
directory before the editor fallback. The encoded MP4 and capture frames are local
delivery artifacts, not required server assets. See `motion-video/README.md` for the
independent web build and video export commands.

Create a dedicated `erect3d` service account. The systemd examples expect Bun at
`/usr/local/bin/bun`; adjust this to the actual installed path. Avoid running as root.

## Production configuration

Create `/opt/erect3d/api/.env.production`, readable only by the service account/operator.
Copy variable names from `.env.example`, then supply real values through your secret
management process. Never put database, storage or Gemini credentials in `VITE_*`.

Minimum production settings:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgres://erect_app:REPLACE_WITH_SECRET@db.internal:5432/erect3d
DATABASE_TLS=verify-full
DATABASE_CA_FILE=/etc/erect3d/postgres-ca.pem
DATABASE_SERVER_NAME=db.internal
ALLOWED_ORIGINS=https://erect3d.olanrewaju.xyz
TRUSTED_PROXY_IPS=127.0.0.1
RATE_LIMIT_BACKEND=postgres
STORAGE_BACKEND=r2
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET=YOUR_PRIVATE_BUCKET
R2_REGION=auto
R2_ACCESS_KEY_ID=REPLACE_WITH_SECRET
R2_SECRET_ACCESS_KEY=REPLACE_WITH_SECRET
PDF_OPTIMIZER_PATH=/usr/bin/qpdf
```

`DATABASE_CA_FILE` is optional if the database certificate chains to a trusted public CA.
The server name must match the certificate. Configure PostgreSQL TLS and verify it on
the VPS; local tests used isolated non-TLS PostgreSQL and do not certify your TLS setup.
Production configuration rejects disabled database verification and HTTP storage endpoints.

Set Gemini credentials only when enabling optional cloud interpretation. Requests require
explicit cloud consent. Confirm model availability in your account using the opt-in check.

## Migrations and database roles

Create the `erect3d` database and a separate migration role that owns schema objects.
Run migration commands using that role's credentials, not the runtime app role:

```sh
cd /opt/erect3d/api
bun --env-file=.env.migrations run migrate
```

The runner takes a database advisory lock, applies ordered SQL files transactionally and
stores a checksum for every migration. Re-running is safe. Changing an already applied
file fails; add a new numbered migration instead. There is no destructive automatic
down-migration. Back up before deployment and test restore procedures independently.

Create an `erect_app` login without superuser/DDL privileges, then apply
`deploy/runtime-role.sql` as the administrator. Replace database/role names if yours differ.
Reapply grants after migrations introducing new objects. Runtime cannot edit/delete
immutable history or change migration checksums. The application migrations are not
automatically run by API/worker startup.

## Private storage

See [R2_STORAGE.md](R2_STORAGE.md) for private R2 credentials, CORS, optimization and
staging lifecycle rules. Create `/var/lib/erect3d` owned by the service account before
starting the systemd units; their write allowance uses that directory. R2 remains the
production store; local filesystem verification does not certify R2 integration.

Give the API/worker credentials PUT, GET, HEAD and DELETE access to the private bucket
prefixes `staging/`, `private/` and `_erect3d/health`. Startup/readiness writes and stats
the private health sentinel. Block anonymous bucket/object reads. Configure exact-origin
bucket CORS for PUT/GET/HEAD and the signed Content-Type header.

The final object key is separate from staging, so a still-valid PUT URL cannot overwrite
a validated plan. Signed upload/download URLs are credentials: avoid logging them, proxying
them into public HTML or including them in analytics. Short expiry limits already-issued
download access after membership changes.

Use a staging lifecycle rule as a second cleanup mechanism. Durable cleanup jobs also
remove unfinalized uploads. Monitor cleanup failures and reconcile orphaned private objects
after database or storage outages; an object store and PostgreSQL cannot share a transaction.
Keep source files private in backups too.

## Start services and proxy

Install `deploy/erect-api.service` and `deploy/erect-worker.service` in the systemd service
directory, then reload systemd and enable/start both services. The worker is separate
from HTTP and can be scaled by additional units/processes. Each process handles one job
at a time, with leases and cancellation checks preventing stale publication.

Install `deploy/nginx.conf` inside Nginx's HTTP context. It serves `client/dist`, proxies
`/api/`, `/health` and `/ready`, supports WebSocket upgrades, and overwrites the trusted
X-Real-IP header. The example TLS certificate paths use your existing public domain.
Run `nginx -t` before reloading. Test these templates on the VPS; they were not executed
on a Linux host during local development.

HTTP JSON is limited to 2 MiB. The browser's optimized binary upload route accepts up to
200 MiB through Nginx/API and compresses files before writing to R2. Signed uploads are
also supported for other clients. Sensitive API access logs are disabled;
ensure upstream load balancers and error logging also redact sensitive paths/URLs.

An alternative API/worker container is provided in the root `Dockerfile`:

```sh
# From the repository root:
docker build -t erect3d-api .
docker run --env-file api/.env.production -e HOST=0.0.0.0 -p 127.0.0.1:4000:4000 erect3d-api
docker run --env-file api/.env.production erect3d-api bun src/workers/index.ts
```

Use production network/service management around these examples. The Docker image has
not been built locally because the Docker daemon was unavailable.

## Deployment gates

1. Run migrations on a disposable `_test` database, API verification and frontend build.
2. Run `check:storage` with your chosen private provider; it verifies signed PUT/GET and
   rejects publicly readable objects. Test browser CORS from the deployed origin too.
3. Explicitly opt in to `check:ai` if enabling Gemini; this spends quota.
4. If using Redis, run the integration test with `TEST_REDIS_URL` pointing to Redis 7.2+.
5. Confirm verified database TLS, production cookie flags, exact origins and proxy IPs.
6. Check `/health`, `/ready`, a full authenticated save/load and two collaboration clients
   through Nginx. Test permissions, worker cancellation and version restore on staging.
7. Verify PostgreSQL and object-store backup restoration and operational alerts.

For updates, migrate with the administration role, restart the API/worker and deploy the
frontend build together. SIGTERM stops new work and closes WebSockets. Unfinished worker
leases can be recovered after expiry. Failed jobs remain queryable; no unaudited automatic
retry of permanently invalid AI output is provided.

## Operations

Monitor API readiness, request latency/error counts, worker completions/failures, oldest
available job, expired/exhausted leases, database pool pressure and storage cleanup failures.
Structured logs contain correlation IDs, not documents/prompts/tokens. Connect a
`TelemetrySink` to your monitoring system when provisioning the VPS. No benchmark-derived
user/concurrency capacity is claimed yet; load test realistic large projects first.
