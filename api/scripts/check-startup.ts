import { readConfig } from '../src/config/env'

const config = readConfig(), port = Number(process.env.SMOKE_PORT || 44001)
if (config.NODE_ENV === 'production') throw new Error('Run startup smoke checks against development configuration')
const child = Bun.spawn([process.execPath, 'src/index.ts'], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdout: 'ignore', stderr: 'ignore',
})
try {
  let ready = false
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error('API exited during startup; run bun run start for diagnostics')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/ready`, { signal: AbortSignal.timeout(1000) })
      ready = response.ok && (await response.json()).status === 'ready'
      if (ready) break
    } catch { /* Allow the real API time to start its database listeners. */ }
    await Bun.sleep(100)
  }
  if (!ready) throw new Error('API readiness did not succeed within 8 seconds')
  const health = await fetch(`http://127.0.0.1:${port}/health`)
  if (!health.ok || (await health.json()).status !== 'alive') throw new Error('Health endpoint failed')
  const protectedRoute = await fetch(`http://127.0.0.1:${port}/api/v1/projects`)
  if (protectedRoute.status !== 401) throw new Error('Unauthenticated project access was not rejected')
  console.log('Real API startup, readiness, health and authentication boundary passed')
} finally {
  child.kill('SIGTERM')
  await child.exited
}
