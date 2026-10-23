# Observability

The API and worker retain their shared JSON logger. Each record includes `at`, `level`
and `event`; HTTP and worker failures include safe request/job/project identifiers and
classified error codes. Set `LOG_LEVEL` to `debug`, `info`, `warn` or `error`.

Raw exception messages, provider responses, SQL, prompts, document bodies, cookies,
credentials and source URLs are not logged. Redaction is bounded and tolerates circular
values. Instrumentation failure must never interrupt an edit or worker lease.

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
- Inspect application stdout through your VPS process manager. Never expose it publicly.
