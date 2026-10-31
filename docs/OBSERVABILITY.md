# Observability

The API and worker retain their shared JSON logger. Every record includes `at`, `level`
and `event`; HTTP and worker failures include safe request/job/project identifiers and
classified error codes. Set `LOG_LEVEL` to `debug`, `info`, `warn` or `error`.

[pino](https://getpino.io) is the emitter behind that contract: it chooses the level, builds the
JSON document and timestamps it, while this repository keeps the field policy. Each line is one
object whose keys arrive in the order `level`, `at`, the caller's fields, then `event`; the level
is the text label (`"info"`, not `30`) and no `pid` or `hostname` is added, so a line matches what
these suites asserted before pino was introduced. Records are written straight to the destination
without a worker thread or transport, and a destination that throws is swallowed: a log line has
never been allowed to fail a request.

The single implementation is `api/src/logging.ts`; `api/src/middleware/observability.ts`
generates one `requestId` per request, stores it on the Hono context, returns it as
`X-Request-Id` and puts it on the `http.request` line, so a log search and a client-side
report meet on the same id. Websocket upgrades keep the id but receive no response headers.

Raw exception messages, provider responses, SQL, prompts, document bodies, cookies,
credentials and source URLs are not logged. Redaction is bounded and tolerates circular
values. Instrumentation failure must never interrupt an edit or worker lease.

## Incident reporting (optional)

Reporting is **off while `SENTRY_DSN` is empty**: no client is created, the Hono application keeps
exactly the middleware stack it always had, and nothing reaches the network. `api/.env.example`
documents `SENTRY_DSN` and `SENTRY_RELEASE`; a DSN is validated like every other endpoint setting
(HTTPS, public key only, no secret, no query, numeric project id) by `api/src/config/validate.ts`.

`api/src/monitoring.ts` holds one policy and one scrub, used by both process entrypoints:

- **Reported:** an unexpected request failure (anything `app.onError` answers as 500) and a job
  failure whose provider code is `AI_UPSTREAM` or `AI_NETWORK`.
- **Not reported:** `ApiError` responses, 3xx/4xx statuses, unique-constraint violations
  (`23505`), and provider results the retry policy already handles (`AI_QUOTA`, `AI_TIMEOUT`,
  refusals, schema rejections). Those remain metrics and structured logs, not incidents.
- **Collected:** `environment` from `NODE_ENV` and `release` from `SENTRY_RELEASE`, plus the
  exception, its own stack frames and, for job failures, the `erect3d` context of `jobId`,
  `requestId`, `kind` and `code` on a scope that is forked per incident.

`dataCollection` switches off what Sentry 11 collects by default — cookies, headers, request and
response bodies, URL query strings, stack-frame locals and the source lines around a throw — and
`tracesSampleRate: 0` leaves volume and latency to this repository's own counters. `beforeSend`
then re-runs the logger's credential scrub over the exception subtree, deletes request cookies,
headers, body and environment, and drops any `Bearer` token or `postgres://`, `redis://`,
`http(s)://` URL. `app.onError` still owns the client-visible error contract: responses are
identical with reporting enabled and disabled, which `api/tests/sentry-reporting.test.ts` proves
against a genuine SDK transport writing to a loopback ingest endpoint (`api/tests/sentry-probe.ts`).

No source maps are uploaded: the API runs un-bundled TypeScript (`bun src/index.ts`), so frames
already name the repository's own files and lines. Both entrypoints flush before exit
(`closeIncidentReporting`), so a crash report is sent without holding shutdown open.

## Self-hosted OpenTelemetry export

Export is **off by default**. Set `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` to the complete
OTLP/HTTP JSON logs endpoint, such as `http://127.0.0.1:4318/v1/logs`, and optionally set
`OTEL_SERVICE_NAME`. The explicit-event exporter sends request summaries, connection
counts, job results and classified errors. This is logs export, not automatic distributed
tracing or SQL/provider payload instrumentation.

It buffers at most 64 records, sends batches of at most 16, allows one request at a time,
and aborts each send after two seconds. Failed batches are dropped without retrying;
network work is independent of application responses. Shutdown cancels export. Protect
your collector endpoint through a private network/reverse proxy; URLs cannot embed secrets.

Collector example: `tools/otel-collector.yml`. Run a compatible OpenTelemetry Collector
with that configuration to inspect accepted events locally. Its debug exporter is a setup
check, not a durable log database. Configure your existing self-hosted destination for
retention and access controls; no hosted account or production collector is provisioned.

## Operations

- `/health` checks process liveness; `/ready` checks configured dependencies.
- Correlate an API response's `X-Request-Id` with `http.request`, `http.error` and worker
  `requestId` fields. Find worker failures by `jobId`, `projectId`, `kind` and `code`.
- `AI_AUTH_FAILED` requires checking server credentials; `AI_TIMEOUT` or `AI_UPSTREAM`
  requires checking provider availability and configured timeout. Do not log source bytes.
- `RATE_LIMIT_UNAVAILABLE` means the selected database/Redis dependency is unavailable;
  fix connectivity or credentials rather than disabling enforcement.
- Open a reported incident by its `release` and `environment`, then read its `requestId` or
  `jobId` back out of stdout: the report is the pointer, the structured line is the record.
- Inspect application stdout through your VPS process manager. Never expose it publicly.
