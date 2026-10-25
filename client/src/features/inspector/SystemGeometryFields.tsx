import type { BuildingSystem } from '../../domain/buildingSystems'
import type { Level } from '../../domain/types'
import { spiralLandings } from '../../geometry/spiralLandings'
import { systemPoints } from '../../domain/systemValidation'
export function SystemGeometryFields({
  system,
  patch,
  levels = [],
}: {
  system: BuildingSystem
  patch: (change: Record<string, unknown>) => void
  levels?: Level[]
}) {
  if (system.kind === 'spiral-stair')
    return (
      <>
        {(['x', 'z'] as const).map((axis) => (
          <label className="inspector-field" key={axis}>
            <span>Center {axis.toUpperCase()} · m</span>
            <input
              type="number"
              step=".1"
              value={system.center[axis]}
              onChange={(e) => patch({ center: { ...system.center, [axis]: Number(e.target.value) } })}
            />
          </label>
        ))}
        <label className="inspector-field">
          <span>Start angle · °</span>
          <input
            type="number"
            value={system.rotation}
            onChange={(e) => patch({ rotation: Number(e.target.value) })}
          />
        </label>
        <label className="inspector-field">
          <span>Clockwise ascent</span>
          <input
            type="checkbox"
            checked={system.clockwise}
            onChange={(e) => patch({ clockwise: e.target.checked })}
          />
        </label>
        <label className="inspector-field">
          <span>Construction</span>
          <select value={system.material} onChange={(e) => patch({ material: e.target.value })}>
            <option value="metal">Metal</option>
            <option value="concrete">Concrete</option>
          </select>
        </label>
        {spiralLandings(system, levels).map((landing) => (
          <label className="inspector-field" key={landing.levelId}>
            <span>{levels.find((l) => l.id === landing.levelId)?.name} landing · °</span>
            <input
              type="number"
              value={Number(((landing.angle * 180) / Math.PI).toFixed(2))}
              onChange={(e) =>
                patch({
                  landings: [
                    ...(system.landings || []).filter((l) => l.levelId !== landing.levelId),
                    { levelId: landing.levelId, angle: Number(e.target.value) },
                  ],
                })
              }
            />
          </label>
        ))}
      </>
    )
  if ((system.kind === 'curtain-wall' || system.kind === 'articulation') && system.curve) {
    const curve = system.curve
    const change = (key: string, value: number) => {
      if (!Number.isFinite(value)) return
      const next =
        key === 'x' || key === 'z'
          ? { ...curve, center: { ...curve.center, [key]: value } }
          : { ...curve, [key]: key.includes('Angle') ? (value * Math.PI) / 180 : value }
      const at = (angle: number) => ({
        x: next.center.x + next.radius * Math.cos(angle),
        z: next.center.z + next.radius * Math.sin(angle),
      })
      patch({ curve: next, path: [at(next.startAngle), at(next.endAngle)] })
    }
    return (
      <fieldset>
        <legend>Facade arc</legend>
        {(['x', 'z', 'radius', 'startAngle', 'endAngle'] as const).map((key) => (
          <label className="inspector-field" key={key}>
            <span>
              {key === 'x'
                ? 'Center X · m'
                : key === 'z'
                  ? 'Center Z · m'
                  : key === 'radius'
                    ? 'Radius · m'
                    : key === 'startAngle'
                      ? 'Start angle · °'
                      : 'End angle · °'}
            </span>
            <input
              type="number"
              step={key.includes('Angle') ? 1 : 0.1}
              value={
                key === 'x' || key === 'z'
                  ? curve.center[key]
                  : key.includes('Angle')
                    ? Number(((curve[key] * 180) / Math.PI).toFixed(3))
                    : curve[key]
              }
              onChange={(e) => change(key, Number(e.target.value))}
            />
          </label>
        ))}
      </fieldset>
    )
  }
  return (
    <>
      {systemPoints(system).map((point, index) => (
        <fieldset className="system-coordinate-field" key={index}>
          <legend>Point {index + 1} · m</legend>
          {(['x', 'z'] as const).map((axis) => (
            <label key={axis}>
              <span>{axis.toUpperCase()}</span>
              <input
                type="number"
                aria-label={`Point ${index + 1} ${axis}`}
                step=".1"
                value={point[axis]}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (!Number.isFinite(value)) return
                  const points = systemPoints(system).map((p, i) =>
                    i === index ? { ...p, [axis]: value } : p,
                  )
                  patch(
                    system.kind === 'articulation' && system.footprint
                      ? { footprint: points, path: points.slice(0, 2) }
                      : 'polygon' in system
                        ? { polygon: points }
                        : 'path' in system
                          ? { path: points }
                          : { start: points[0], end: points[1] },
                  )
                }}
              />
            </label>
          ))}
        </fieldset>
      ))}
    </>
  )
}
