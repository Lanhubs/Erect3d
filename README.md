# Erect3D

An editable architectural workspace for drawing floor plans, reconstructing imported plans,
and exploring the same building model in 2D, 3D and walkthrough views.

The application includes multi-storey buildings, linked floors, roofs, stairs, furniture,
templates, project collaboration, offline editing and a reviewable Gemini design assistant.
Reconstruction produces editable proposals that require architectural review; it is not a
guarantee of survey accuracy, structural safety or a complete design from every drawing.

## Architecture

| Directory       | Responsibility                                                                             |
| --------------- | ------------------------------------------------------------------------------------------ |
| `client/`       | React/Vite editor, canonical model, geometry, Three.js/WebGPU rendering and offline cache  |
| `api/`          | Bun/Hono API, PostgreSQL persistence, sessions, collaboration, private storage and workers |
| `motion-video/` | Independent film website and optional 35-second MP4 capture/export tooling                 |

All three packages have independent manifests and lockfiles. Shared geometry remains in
the client source tree; install all packages before running cross-package checks or builds.
The root package contains development tooling only, not a replacement workspace layout.

## Prerequisites

- **Bun 1.4.2**, the pinned installation and test runtime.
- **Docker Compose v2** for the local backend and PostgreSQL 17, or a separately installed
  PostgreSQL 17 with disposable development/test databases.
- A browser with hardware graphics acceleration. WebGPU is preferred; the existing
  Compatibility renderer remains available. Native WebGPU tower startup is an open issue.
- MP4 export additionally requires a local browser capture setup and FFmpeg; neither is
  required to run, test or build the editor.

## Install and run

Run from the repository root:

```sh
bun install --frozen-lockfile
bun run setup
docker compose up -d --build
bun run dev:client
```

Open `http://127.0.0.1:5173`. Compose starts PostgreSQL, migrations, API and worker. Account
creation is enabled for this loopback-only development setup. Gemini and R2 are optional:
without credentials, manual editing, templates, accounts and collaboration work, while
cloud-dependent actions report that they are unavailable.

For a host-run API/worker instead, start only PostgreSQL with
`docker compose up -d postgres`, copy `api/.env.example` to `api/.env.local`, then run:

```sh
cd api
bun run migrate
cd ..
bun run dev:api
# In separate terminals:
bun run dev:worker
bun run dev:client
```

Do not run the Compose API and host API on port 4000 simultaneously. Compose's database
initialization creates separate `erect_dev` and `erect_api_test` databases on the first start
of its named volume. For an existing volume, create the missing test database explicitly;
do not delete a volume containing projects. Stop services with `docker compose down`.

## Tests and automated checks

Copy the root `.env.example` to `.env.local` for disposable local test defaults. Do not
reuse a live database. Preparation requires an explicit `TEST_DATABASE_URL` ending in
`_test` and never falls back to `DATABASE_URL`.

```sh
docker compose up -d postgres
bun run test:prepare
bun run test
bun run lint
bun run format:check
bun run typecheck
bun run coverage
bun run build
```

`bun run verify` runs lint, formatting, types, tests and the combined production web build.
The backend runs directly under Bun; CI also builds its production Docker image.
Tests use synthetic drawings, injected AI providers and in-memory private storage. They
do not call Gemini or upload drawings to R2. Redis integration is enabled by setting
`TEST_REDIS_URL`; CI supplies Redis and runs that check too.

Coverage reports describe production modules imported by tests, not whole-application
coverage. Reports and baseline gates are described in [verification](docs/VERIFICATION.md).
Browser rendering, graphics quality and external-provider checks are separate evidence.

## Configuration

| Example               | Purpose                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `.env.example`        | Root verification's disposable test database and optional Redis URL          |
| `api/.env.example`    | API/worker database, sessions, optional R2/Gemini and observability settings |
| `client/.env.example` | Public client settings only; never place server secrets in `VITE_*`          |

The API configuration validator is the authority for accepted settings. Private Gemini
and R2 keys stay on the server. Explicit live checks are operator-invoked, separately
documented commands; normal CI requires no cloud accounts. Uploaded originals retain
their quality; storage optimization uses lossless processing/archiving.

## Builds, film and deployment

`bun run build` builds the editor and independent film website into `client/dist`, with
the film mounted at `/motion/erect3d-film/`. The film's assets stay outside editor startup
and offline caching. Use `bun run dev:film` for independent development.

- [Film build, capture and MP4 export](motion-video/README.md)
- [Detailed plan interpretation, model configuration and verification limits](api/docs/DETAILED_PLAN_INTERPRETATION.md)
- [VPS deployment, TLS, backups and operations](api/docs/VPS.md)
- [API architecture](api/docs/ARCHITECTURE.md) and [editor architecture](client/ARCHITECTURE.md)
- [Observability](docs/OBSERVABILITY.md), [contributing](CONTRIBUTING.md) and [security](SECURITY.md)
- [Changes](CHANGELOG.md) and [assessment evidence](docs/REASSESSMENT.md)

GitHub Actions verifies pull requests and pushes. Renovate configuration prepares reviewed
dependency updates, but its GitHub installation must be enabled by a repository owner.
No release, deployment, external account activation or ownership/license change is implied.
