import type { IEntity, IPoint } from 'dxf-parser'
import type { CadBounds, CadLabel, CadPoint, CadScene, CadStroke } from './types'
import { scaleOf, type CadTransform, type PlacedEntity } from './dxf-transform'

type Vertex = IPoint & { bulge?: number }

function project(point: { x: number; y: number }, transform: CadTransform): CadPoint {
  const cos = Math.cos(transform.rotation),
    sin = Math.sin(transform.rotation)
  return {
    x: transform.x + point.x * transform.scaleX * cos - point.y * transform.scaleY * sin,
    y: transform.y + point.x * transform.scaleX * sin + point.y * transform.scaleY * cos,
  }
}

const arcSteps = (sweep: number) => Math.max(6, Math.min(96, Math.ceil(Math.abs(sweep) / 0.05)))

/** Center and radius are already in drawing units; only the sampling is done here. */
function arcPoints(center: CadPoint, radius: number, from: number, sweep: number): CadPoint[] {
  const steps = arcSteps(sweep)
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = from + (sweep * index) / steps
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
  })
}

// A polyline bulge is the tangent of a quarter of the included angle, so rebuilding the arc
// keeps door swings and curved walls readable after rasterisation.
function bulgePoints(from: CadPoint, to: CadPoint, bulge: number): CadPoint[] {
  const sweep = 4 * Math.atan(bulge),
    chord = Math.hypot(to.x - from.x, to.y - from.y)
  if (!Number.isFinite(sweep) || Math.abs(sweep) < 1e-6 || chord < 1e-9) return [to]
  const radius = chord / (2 * Math.sin(Math.abs(sweep) / 2)),
    normal = { x: (to.x - from.x) / chord, y: (to.y - from.y) / chord },
    center = {
      x: (from.x + to.x) / 2 + normal.y * radius * Math.cos(sweep / 2),
      y: (from.y + to.y) / 2 - normal.x * radius * Math.cos(sweep / 2),
    }
  return arcPoints(center, radius, Math.atan2(from.y - center.y, from.x - center.x), sweep).slice(1)
}

function vertices(points: Vertex[], transform: CadTransform): CadPoint[] {
  const out: CadPoint[] = []
  points.forEach((point, index) => {
    const at = project(point, transform)
    if (index === 0) out.push(at)
    else {
      const previous = points[index - 1]
      out.push(...(previous?.bulge ? bulgePoints(out[out.length - 1], at, previous.bulge) : [at]))
    }
  })
  return out
}

function ellipsePoints(entity: IEntity, transform: CadTransform): CadPoint[] {
  const value = entity as unknown as { center: IPoint; majorAxisEndPoint: IPoint; axisRatio: number }
  const radius = Math.hypot(value.majorAxisEndPoint.x, value.majorAxisEndPoint.y),
    minor = radius * (value.axisRatio || 1),
    tilt = Math.atan2(value.majorAxisEndPoint.y, value.majorAxisEndPoint.x)
  return Array.from({ length: 49 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 48
    return project(
      {
        x:
          value.center.x +
          radius * Math.cos(angle) * Math.cos(tilt) -
          minor * Math.sin(angle) * Math.sin(tilt),
        y:
          value.center.y +
          radius * Math.cos(angle) * Math.sin(tilt) +
          minor * Math.sin(angle) * Math.cos(tilt),
      },
      transform,
    )
  })
}

function curvedStroke(entity: IEntity, transform: CadTransform): CadStroke | null {
  const value = entity as unknown as {
    center: IPoint
    radius: number
    startAngle?: number
    endAngle?: number
  }
  const center = project(value.center, transform),
    radius = value.radius * scaleOf(transform)
  if (!(radius > 0) || !Number.isFinite(radius)) return null
  if (entity.type === 'CIRCLE') return { points: arcPoints(center, radius, 0, Math.PI * 2), closed: true }
  let sweep = (value.endAngle || 0) - (value.startAngle || 0)
  if (sweep <= 0) sweep += Math.PI * 2
  return { points: arcPoints(center, radius, value.startAngle || 0, sweep), closed: false }
}

function linedStroke(entity: IEntity, transform: CadTransform): CadStroke | null {
  const value = entity as unknown as {
    vertices?: Vertex[]
    points?: IPoint[]
    shape?: boolean
    closed?: boolean
  }
  const list: Vertex[] = value.vertices || value.points || []
  if (list.length < 2) return null
  return { points: vertices(list, transform), closed: Boolean(value.shape ?? value.closed) }
}

function stroke(entity: IEntity, transform: CadTransform): CadStroke | null {
  switch (entity.type) {
    case 'LINE':
    case 'LWPOLYLINE':
    case 'POLYLINE':
    case 'SOLID':
      return linedStroke(entity, transform)
    case 'SPLINE': {
      const spline = entity as unknown as { fitPoints?: IPoint[]; controlPoints?: IPoint[]; closed?: boolean }
      const points = spline.fitPoints || spline.controlPoints || []
      return points.length < 2
        ? null
        : { points: vertices(points, transform), closed: Boolean(spline.closed) }
    }
    case 'ARC':
    case 'CIRCLE':
      return curvedStroke(entity, transform)
    case 'ELLIPSE':
      return { points: ellipsePoints(entity, transform), closed: true }
    default:
      return null
  }
}

function label(entity: IEntity, transform: CadTransform): CadLabel | null {
  const value = entity as unknown as {
    text?: string
    startPoint?: IPoint
    position?: IPoint
    textHeight?: number
    height?: number
  }
  const at = value.startPoint || value.position
  const text = (value.text || '').replace(/\\P|[{}]/g, ' ').trim()
  if (!text || !at) return null
  return {
    x: project(at, transform).x,
    y: project(at, transform).y,
    height: (value.textHeight || value.height || 0) * scaleOf(transform),
    text,
  }
}

function extend(bounds: CadBounds, point: CadPoint) {
  bounds.minX = Math.min(bounds.minX, point.x)
  bounds.minY = Math.min(bounds.minY, point.y)
  bounds.maxX = Math.max(bounds.maxX, point.x)
  bounds.maxY = Math.max(bounds.maxY, point.y)
}

/** Turns placed entities into draw-ready polylines and text, still in drawing units. */
export function tessellate(placed: PlacedEntity[]): CadScene {
  const bounds: CadBounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
    strokes: CadStroke[] = [],
    labels: CadLabel[] = []
  for (const { entity, transform } of placed) {
    if (entity.type === 'TEXT' || entity.type === 'MTEXT' || entity.type === 'ATTRIB') {
      const text = label(entity, transform)
      if (text) {
        labels.push(text)
        extend(bounds, { x: text.x, y: text.y })
      }
      continue
    }
    const shape = stroke(entity, transform)
    if (!shape || !shape.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)))
      continue
    strokes.push(shape)
    for (const point of shape.points) extend(bounds, point)
  }
  return { strokes, labels, bounds, entityCount: placed.length }
}
