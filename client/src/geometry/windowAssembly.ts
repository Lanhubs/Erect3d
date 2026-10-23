import type { Wall, WindowUnit } from '../domain/types'
import type { InstancePart } from '../rendering/EntityInstances'
import { atWall, wallTangentAngle } from './math'
import { windowConstruction, windowConstructionIssue } from '../domain/windowConstruction'
export function windowAssembly(wall: Wall, window: WindowUnit) {
  const issue = windowConstructionIssue(window, wall)
  if (issue) throw new Error(issue)
  const frame: InstancePart[] = [],
    glass: InstancePart[] = [],
    sill: InstancePart[] = [],
    hardware: InstancePart[] = []
  const p = windowConstruction(window, wall),
    w = window.width,
    h = window.height,
    f = p.frameWidth,
    bar = Math.min(f, 0.045)
  const center = atWall(wall, window.offset + w / 2),
    angle = -wallTangentAngle(wall, window.offset + w / 2),
    selection = { kind: 'window' as const, id: window.id }
  const add = (
    parts: InstancePart[],
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ) => {
    const step = wall.curve
      ? 2 * wall.curve.radius * Math.acos(Math.max(-1, 1 - 0.0025 / wall.curve.radius))
      : Infinity
    const count = Math.max(1, Math.ceil(width / step))
    if (count > 1024) throw new Error('Window curvature exceeds the geometry budget.')
    for (let i = 0; i < count; i++) {
      const span = width / count,
        offset = x - width / 2 + (i + 0.5) * span,
        origin = wall.curve ? atWall(wall, window.offset + w / 2 + offset) : center
      const rotation = wall.curve ? -wallTangentAngle(wall, window.offset + w / 2 + offset) : angle,
        along = wall.curve ? 0 : offset
      parts.push({
        center: [
          origin.x + along * Math.cos(rotation) + z * Math.sin(rotation),
          window.sill + y,
          origin.z - along * Math.sin(rotation) + z * Math.cos(rotation),
        ],
        size: [span, height, depth],
        rotation,
        selection,
      })
    }
  }
  for (const side of [-1, 1]) {
    add(frame, (side * (w - f)) / 2, h / 2, p.frameOffset, f, h, p.frameDepth)
    add(frame, 0, side < 0 ? f / 2 : h - f / 2, p.frameOffset, w - 2 * f, f, p.frameDepth)
  }
  const paneW = (w - 2 * f - p.mullions * bar) / (p.mullions + 1),
    paneH = (h - 2 * f - p.transoms * bar) / (p.transoms + 1)
  for (let i = 0; i < p.mullions; i++)
    add(
      frame,
      -w / 2 + f + (i + 1) * paneW + (i + 0.5) * bar,
      h / 2,
      p.frameOffset,
      bar,
      h - 2 * f,
      p.frameDepth,
    )
  for (let x = 0; x <= p.mullions; x++) {
    const cx = -w / 2 + f + paneW / 2 + x * (paneW + bar)
    for (let y = 0; y <= p.transoms; y++)
      add(glass, cx, f + paneH / 2 + y * (paneH + bar), p.frameOffset, paneW, paneH, 0.008)
    for (let y = 0; y < p.transoms; y++)
      add(frame, cx, f + (y + 1) * paneH + (y + 0.5) * bar, p.frameOffset, paneW, bar, p.frameDepth)
  }
  if (p.sillProjection > 0)
    add(sill, 0, -0.0225, 0, w + 2 * p.sillProjection, 0.045, wall.thickness + 2 * p.sillProjection)
  if (window.type === 'casement')
    add(hardware, w / 2 - f - 0.025, h * 0.48, p.frameOffset + p.frameDepth / 2 + 0.018, 0.025, 0.12, 0.025)
  return { frame, glass, sill, hardware }
}
