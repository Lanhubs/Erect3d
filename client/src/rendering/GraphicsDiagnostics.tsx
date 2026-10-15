import type { GraphicsSnapshot } from './GraphicsRuntime'
export function GraphicsDiagnostics({ stats }: { stats: GraphicsSnapshot | null }) {
  if (!import.meta.env.DEV) return null
  return <details className="graphics-diagnostics"><summary>Graphics diagnostics · DEV</summary>
    <output aria-label="Graphics measurements">{stats ? JSON.stringify(stats, (_, value) =>
      typeof value === 'number' ? Math.round(value * 100) / 100 : value, 2) : 'Warming renderer…'}</output>
    <p>CPU measures render submission. Tracked memory excludes driver overhead; unavailable metrics are null. Idle frames are excluded.</p>
  </details>
}
