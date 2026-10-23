export interface TelemetrySink {
  record(event: 'request' | 'job' | 'connection' | 'error', fields: Record<string, string | number>): void
  close?(): void
}
export function report(
  sink: TelemetrySink | undefined,
  event: 'request' | 'job' | 'connection' | 'error',
  fields: Record<string, string | number>,
) {
  try {
    sink?.record(event, fields)
  } catch {
    /* Instrumentation must not interrupt architecture or authorization. */
  }
}
