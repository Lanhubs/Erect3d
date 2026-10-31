import type { Level, Wall, WallCurve } from '../../domain/types'
import { wallLength, wallWithCurve } from '../../geometry/math'
import { resizeWall, rotateWall, splitPosition, splitWall, wallAngle } from '../../geometry/editWall'
import { useProject } from '../../state/project'
import type { Unit } from '../../geometry/units'
import { NumberField } from './NumberField'
import { wallMaterials } from './inspectorMaterials'
import { curveDegrees, curveRadians, minimumWallLength, wallKind, wallPaint } from './inspectorRules'

export function WallInspector({
  wall,
  level,
  unit,
  change,
}: {
  wall: Wall
  level: Level
  unit: Unit
  change: (values: Record<string, string | number>) => void
}) {
  const edit = useProject((s) => s.edit)
  const updateCurve = (patch: Partial<WallCurve>) => {
    if (!wall.curve) return
    const curve = { ...wall.curve, ...patch }
    edit((model) => ({
      ...model,
      walls: model.walls.map((item) => (item.id === wall.id ? wallWithCurve(item, curve) : item)),
    }))
  }
  const minLength = minimumWallLength(wall, level)
  return (
    <div className="fields">
      {wall.curve ? (
        <>
          <NumberField
            label="Curve radius"
            unit={unit}
            value={wall.curve.radius}
            min={0.1}
            onChange={(radius) => updateCurve({ radius: Math.max(0.1, radius) })}
          />
          <NumberField
            label="Center X"
            unit={unit}
            value={wall.curve.center.x}
            onChange={(x) => updateCurve({ center: { ...wall.curve!.center, x } })}
          />
          <NumberField
            label="Center Z"
            unit={unit}
            value={wall.curve.center.z}
            onChange={(z) => updateCurve({ center: { ...wall.curve!.center, z } })}
          />
          <label className="inspector-field">
            <span>Start angle · °</span>
            <input
              aria-label="Curve start angle"
              type="number"
              step="1"
              value={curveDegrees(wall.curve.startAngle)}
              onChange={(event) => updateCurve({ startAngle: curveRadians(Number(event.target.value)) })}
            />
          </label>
          <label className="inspector-field">
            <span>End angle · °</span>
            <input
              aria-label="Curve end angle"
              type="number"
              step="1"
              value={curveDegrees(wall.curve.endAngle)}
              onChange={(event) => updateCurve({ endAngle: curveRadians(Number(event.target.value)) })}
            />
          </label>
        </>
      ) : (
        <>
          <NumberField
            label="Length"
            unit={unit}
            value={wallLength(wall)}
            min={minLength}
            onChange={(length) =>
              edit((model) => ({
                ...model,
                walls: model.walls.map((item) =>
                  item.id === wall.id ? resizeWall(item, Math.max(minLength, length)) : item,
                ),
              }))
            }
          />
          <label className="inspector-field">
            <span>Angle · °</span>
            <input
              aria-label="Wall angle"
              type="number"
              step="1"
              value={Number(wallAngle(wall).toFixed(1))}
              onChange={(event) =>
                edit((model) => ({
                  ...model,
                  walls: model.walls.map((item) =>
                    item.id === wall.id ? rotateWall(item, Number(event.target.value)) : item,
                  ),
                }))
              }
            />
          </label>
        </>
      )}
      <label className="inspector-field">
        <span>Wall type</span>
        <select
          aria-label="Wall type"
          value={wallKind(wall)}
          onChange={(event) => change({ kind: event.target.value })}
        >
          <option value="exterior">Exterior</option>
          <option value="interior">Interior</option>
          <option value="partition">Partition</option>
        </select>
      </label>
      <NumberField
        label="Thickness"
        unit={unit}
        value={wall.thickness}
        min={0.05}
        onChange={(thickness) => change({ thickness })}
      />
      <NumberField
        label="Height"
        unit={unit}
        value={wall.height}
        min={1}
        onChange={(height) => change({ height })}
      />
      <label className="inspector-field">
        <span>Finish</span>
        <select value={wall.material} onChange={(event) => change({ material: event.target.value })}>
          {wallMaterials.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="inspector-field">
        <span>Paint color</span>
        <input
          type="color"
          value={wallPaint(wall)}
          onChange={(event) => change({ color: event.target.value })}
        />
      </label>
      <button
        className="inspector-action"
        type="button"
        disabled={splitPosition(wall, level.doors, level.windows, level.passages) === null}
        onClick={() =>
          edit((model) => ({
            ...model,
            ...splitWall(model.walls, model.doors, model.windows, wall.id, model.passages),
          }))
        }
      >
        Split wall
      </button>
    </div>
  )
}
