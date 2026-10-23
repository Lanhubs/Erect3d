import type { Building, Point } from './types'
import type { BuildingSystem } from './buildingSystems'
import { containsPolygon } from '../geometry/polygons'
import { maxFloorInstances } from './floorRepetition'
export function systemPoints(system: BuildingSystem): Point[] {
  if (system.kind === 'spiral-stair') return [system.center]
  if (system.kind === 'articulation' && system.footprint) return system.footprint
  if ('polygon' in system) return system.polygon
  if ('path' in system) return system.path
  if ('start' in system) return [system.start, system.end]
  return []
}
function validRing(points: Point[]) {
  if (points.length < 3 || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))) return false
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length]
    area += a.x * b.z - b.x * a.z
    if (Math.hypot(a.x - b.x, a.z - b.z) < 0.001) return false
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue
      const c = points[j],
        d = points[(j + 1) % points.length]
      const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return false
    }
  }
  return Math.abs(area) > 0.0001
}
export function validateSystems(building: Building): string[] {
  const issues: string[] = [],
    ids = new Set<string>()
  for (const system of building.systems?.systems || []) {
    const error = (message: string) => issues.push(`${system.name}: ${message}`)
    if (ids.has(system.id)) error('duplicate architectural identity')
    ids.add(system.id)
    const level = building.levels.find((l) => l.id === system.levelId)
    if (!level) error('host level is missing')
    if ('wallIds' in system && system.wallIds?.some((id) => !level?.walls.some((w) => w.id === id)))
      error('source wall host is missing')
    if (!Number.isFinite(system.elevation)) error('elevation must be finite')
    if ('polygon' in system && !validRing(system.polygon)) error('footprint must be a simple nonzero polygon')
    if ('height' in system && (!Number.isFinite(system.height) || system.height <= 0))
      error('height must be positive')
    if (system.kind === 'spiral-stair') {
      if (
        [
          system.center.x,
          system.center.z,
          system.radius,
          system.width,
          system.riserHeight,
          system.turnHeight,
          system.rotation,
        ].some((n) => !Number.isFinite(n))
      )
        error('stair dimensions must be finite')
      if (
        system.width <= 0 ||
        system.radius <= system.width ||
        system.riserHeight <= 0 ||
        system.turnHeight <= 0
      )
        error('stair requires a clear annular flight and positive rise')
      if (Math.ceil(system.height / system.riserHeight) > 30000)
        error('stair exceeds its tread allocation budget')
      for (const landing of system.landings || []) {
        const target = building.levels.find((l) => l.id === landing.levelId),
          base = (level?.elevation || 0) + system.elevation
        if (!target || !Number.isFinite(landing.angle)) {
          error('landing requires an existing level and finite angle')
          continue
        }
        const rise = target.elevation - base,
          phase = system.rotation + (((system.clockwise ? 1 : -1) * rise) / system.turnHeight) * 360,
          difference = ((landing.angle - phase) * Math.PI) / 180
        if (
          rise < -0.001 ||
          rise > system.height + 0.001 ||
          Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) >
            system.width / (2 * system.radius)
        )
          error('landing must meet the flight at its floor elevation; adjust start angle or rise per turn')
      }
    }
    if (system.kind === 'articulation') {
      const curve = system.curve,
        length = curve
          ? curve.radius * Math.abs(curve.endAngle - curve.startAngle)
          : Math.hypot(system.path[1]?.x - system.path[0]?.x, system.path[1]?.z - system.path[0]?.z)
      const projection = curve
        ? Math.sign(curve.endAngle - curve.startAngle) * (system.side === 'left' ? 1 : -1) * system.depth
        : 0
      if (
        curve &&
        ([curve.center.x, curve.center.z, curve.radius, curve.startAngle, curve.endAngle].some(
          (n) => !Number.isFinite(n),
        ) ||
          curve.radius <= 0 ||
          curve.radius - projection <= 0.001 ||
          Math.abs(curve.endAngle - curve.startAngle) > 2 * Math.PI + 0.00001)
      )
        error('detail arc must have finite dimensions and a non-inverting projection')
      if (curve && ['portal', 'arch'].includes(system.profile))
        error('an entrance arch requires its straight opening span, separate from a curved enclosure')
      if (
        system.path.length !== 2 ||
        !Number.isFinite(length) ||
        length < 0.1 ||
        system.path.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))
      )
        error('detail requires a finite source span')
      if ([system.depth, system.thickness, system.spacing].some((n) => !Number.isFinite(n) || n <= 0))
        error('detail dimensions must be positive')
      if (length / system.spacing > 4096) error('detail repetition exceeds its placement budget')
      if (system.footprint && !validRing(system.footprint)) error('detail footprint must be a simple polygon')
      if (system.footprint && !['canopy', 'balcony', 'veranda'].includes(system.profile))
        error('this detail uses its source span; polygon platforms belong to canopies, balconies or verandas')
      if (
        system.footprint &&
        system.footprint.reduce(
          (sum, p, i) =>
            sum +
            Math.hypot(
              p.x - system.footprint![(i + 1) % system.footprint!.length].x,
              p.z - system.footprint![(i + 1) % system.footprint!.length].z,
            ),
          0,
        ) /
          system.spacing >
          16384
      )
        error('detail perimeter exceeds its railing placement budget')
      if (system.profile === 'arch' && (system.height < length / 2 || system.thickness >= length / 2))
        error('arch rise and section must leave a clear opening')
      if (['balcony', 'railing'].includes(system.profile) && system.height > 3)
        error('guard height is not building height; represent vertical circulation with a stair system')
    }
    if (
      system.kind === 'massing' &&
      system.holes.some((h) => !validRing(h) || !containsPolygon(system.polygon, h))
    )
      error('void must be inside its mass')
    if (
      system.kind === 'beam' &&
      Math.hypot(system.start.x - system.end.x, system.start.z - system.end.z) < 0.01
    )
      error('beam requires a nonzero span')
    if (system.kind === 'curtain-wall') {
      if ([system.bayWidth, system.transomHeight, system.depth].some((n) => !Number.isFinite(n) || n <= 0))
        error('facade dimensions must be finite and positive')
      if (system.path.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z)))
        error('facade points must be finite')
      const curve = system.curve
      if (
        curve &&
        (!Number.isFinite(curve.radius) ||
          curve.radius <= 0 ||
          [curve.startAngle, curve.endAngle, curve.center.x, curve.center.z].some(
            (n) => !Number.isFinite(n),
          ) ||
          Math.abs(curve.endAngle - curve.startAngle) < 0.00001 ||
          Math.abs(curve.endAngle - curve.startAngle) > Math.PI * 2 + 0.00001)
      )
        error('arc requires a finite radius and a nonzero sweep of at most one revolution')
      const length = curve
        ? curve.radius * Math.abs(curve.endAngle - curve.startAngle)
        : system.path
            .slice(1)
            .reduce((sum, p, i) => sum + Math.hypot(p.x - system.path[i].x, p.z - system.path[i].z), 0)
      if (length < 0.001) error('facade requires a nonzero span')
      if (
        system.transomHeight > 0 &&
        system.bayWidth > 0 &&
        (length / system.bayWidth) * Math.ceil(system.height / system.transomHeight) > 24000
      )
        error('facade exceeds the supported panel budget')
    }
    if (system.kind === 'typical-floors') {
      if (!building.levels.some((l) => l.id === system.templateLevelId)) error('template level is missing')
      if (
        !Number.isSafeInteger(system.count) ||
        system.count < 1 ||
        system.count > maxFloorInstances ||
        !Number.isFinite(system.floorHeight) ||
        system.floorHeight <= 0
      )
        error('floor repetition exceeds the safe instance allocation budget')
      for (const [index, levelId] of Object.entries(system.detached))
        if (!/^\d+$/.test(index) || +index >= system.count || !building.levels.some((l) => l.id === levelId))
          error('detached floor link is invalid')
    }
  }
  return issues
}
