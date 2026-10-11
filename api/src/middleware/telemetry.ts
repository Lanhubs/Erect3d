export interface TelemetrySink {
  record(event: 'request' | 'job' | 'connection', fields: Record<string, string | number>): void
}
export function report(sink: TelemetrySink | undefined,event: 'request' | 'job' | 'connection',fields: Record<string, string | number>) {
  try { sink?.record(event,fields) } catch { /* Instrumentation must not interrupt architecture or authorization. */ }
}
