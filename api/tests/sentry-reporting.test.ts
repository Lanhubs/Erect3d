import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))

/**
 * A controlled exception, reported through the real SDK transport to a loopback ingest endpoint.
 * The probe runs as its own process because `Sentry.init` installs process-wide handlers, and a
 * leaked client would change how every later file in this suite boots its own applications. Its
 * output is deterministic apart from request ids, so one spawn serves every assertion below.
 */
let outcome: Record<string, any> | undefined
function probe(): Record<string, any> {
  if (outcome) return outcome
  const run = spawnSync(process.execPath, ['api/tests/sentry-probe.ts'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
  })
  expect(run.status, run.stderr).toBe(0)
  // The probe reports through the real logger, so its summary is the final stdout line.
  return (outcome = JSON.parse(run.stdout.trimEnd().split(/\r?\n/).pop() ?? ''))
}

test('reporting is enabled and cannot change how the API answers', () => {
  const result = probe()
  expect(result.started).toBe(true)
  expect(result.withReporting).toEqual(result.withoutReporting)
  expect(result.withReporting['/invalid']).toEqual({
    status: 400,
    body: { error: { code: 'VALIDATION', message: 'Body rejected' } },
    requestId: true,
  })
  expect(result.withReporting['/boom']).toMatchObject({ status: 500 })
  expect(result.withReporting['/ok']).toMatchObject({ status: 200 })
}, 60_000)

test('the mounted application keeps its routes and its fail-closed protections', () => {
  const { routing } = probe()
  expect(routing.health).toEqual({ status: 'alive' })
  expect(routing.routes).toBeGreaterThan(50)
  // This probe has no database, so readiness and every rate-limited route stay closed as designed.
  expect(routing.ready).toBe(503)
  expect(routing.openapi).toBe(503)
})

test('only unexpected failures become incidents, and each incident is scrubbed', () => {
  const result = probe()
  const incidents = result.envelopes.filter((body: string) => body.includes('"exception"'))
  expect(result.incidentCount).toBe(incidents.length)
  const http = incidents.filter((body: string) => body.includes('TypeError'))
  const job = incidents.filter((body: string) => body.includes('probe-job'))
  expect(http).toHaveLength(1)
  expect(job).toHaveLength(1)
  expect(http[0]).toContain('/boom')
  expect(http[0]).toContain('erect3d-api@probe')
  expect(http[0]).toContain('production')
  // The thrown driver message carried a live-looking connection string; it must not survive scrubbing.
  expect(http[0]).not.toContain('private-password')
  expect(http[0]).not.toContain('db.internal')
  expect(http[0]).toContain('[REDACTED URL]')
  // Source context is switched off: the lines around a throw are repository content, not incident data.
  expect(http[0]).not.toContain('pre_context')
  // A job failure keeps its own identifiers and reports as handled, without a second copy per request.
  expect(job[0]).toContain('AI_UPSTREAM')
  expect(job[0]).toContain('"erect3d"')
  expect(job[0]).toContain('probe-request')
  for (const body of result.envelopes) {
    expect(body).not.toContain('probe-session-value')
    expect(body).not.toContain('erect_session')
    expect(body).not.toContain('probe-quiet')
  }
  // A validation rejection, a unique-constraint conflict, a plain 404 and unconfigured cloud AI are not incidents.
  const reported = result.envelopes.join('')
  for (const expected of ['VALIDATION', 'duplicate key value', 'NOT_FOUND', 'AI_QUOTA', 'AI_UNAVAILABLE'])
    expect(reported, expected).not.toContain(expected)
})
