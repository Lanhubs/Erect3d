import { furnishedHouseSample } from '../../client/src/domain/furnishedSample'
import { wallSolids } from '../../client/src/geometry/walls'
import { stairSteps, localToWorld } from '../../client/src/geometry/stairs'
import { atWall } from '../../client/src/geometry/math'
import { editStep } from './timeline'
const original = furnishedHouseSample(),
  ids = new Map<string, string>()
let sequence = 0
function collect(v: unknown) {
  if (!v || typeof v !== 'object') return
  if ('id' in v && typeof v.id === 'string') ids.set(v.id, `film-${++sequence}`)
  Object.values(v).forEach((x) => (Array.isArray(x) ? x.forEach(collect) : collect(x)))
}
collect(original)
export const filmProject = JSON.parse(
  JSON.stringify(original, (_key, value) => (typeof value === 'string' ? ids.get(value) || value : value)),
) as typeof original
filmProject.modified = 0
export const building = filmProject.buildings[0],
  ground = building.levels[0]
for (const l of building.levels)
  l.windows.push(
    {
      id: `film-front-window-${l.id}`,
      wallId: l.walls[2].id,
      offset: 8.5,
      width: 1.6,
      height: 1.5,
      sill: 0.7,
    },
    { id: `film-front-east-${l.id}`, wallId: l.walls[2].id, offset: 1.5, width: 1.6, height: 1.5, sill: 0.7 },
  )
export const selectedWindow = ground.windows.find((w) => w.id === `film-front-window-${ground.id}`)!
building.roof = {
  ...building.roof!,
  shape: 'hip',
  material: 'standing-seam',
  color: '#585b59',
  pitch: 20,
  overhang: 0.55,
}
// Local authored showcase additions use the same editable detail model as the editor.
for (const l of building.levels) {
  l.walls.forEach((w) => {
    w.color = w.kind === 'interior' ? '#e6dfd2' : '#e2dbcc'
  })
  l.details = [
    {
      id: `film-screen-${l.id}`,
      name: 'Entrance timber screen',
      kind: 'fin',
      start: { x: 7.5, z: 10.2 },
      end: { x: 10.9, z: 10.2 },
      baseElevation: 0,
      height: 2.6,
      depth: 0.16,
      spacing: 0.28,
      material: 'timber',
    },
  ]
}
building.levels[1].doors[0].veranda = {
  width: 3,
  depth: 1.4,
  side: 'right',
  covered: false,
  railing: true,
  roofShape: 'shed',
  floorMaterial: 'concrete',
}
ground.doors[0].veranda = {
  width: 3,
  depth: 1.4,
  side: 'right',
  covered: true,
  railing: false,
  roofShape: 'shed',
  floorMaterial: 'concrete',
}
export const windowVariants = Array.from({ length: 11 }, (_, i) => ({
  ...selectedWindow,
  width: Number((1.6 + i * 0.08).toFixed(2)),
}))
export const windowAt = (time: number) => windowVariants[editStep(time)]
export function planSvg(width = 1.6, labels = true) {
  const walls = ground.walls
    .map((w) =>
      wallSolids(
        w,
        ground.doors,
        ground.windows.map((x) => (x.id === selectedWindow.id ? { ...x, width } : x)),
        ground.passages,
      )
        .filter((s) => s.bottom === 0)
        .map((s) => {
          const a = atWall(w, s.start),
            b = atWall(w, s.end)
          return `<path d="M${a.x},${a.z}L${b.x},${b.z}" stroke-width="${w.thickness}"/>`
        })
        .join(''),
    )
    .join('')
  const windows = ground.windows
    .map((w) => {
      const host = ground.walls.find((h) => h.id === w.wallId)!,
        a = atWall(host, w.offset),
        b = atWall(host, w.offset + (w.id === selectedWindow.id ? width : w.width))
      return `<path d="M${a.x},${a.z}L${b.x},${b.z}" stroke="#8d9c9f" stroke-width=".09"/>`
    })
    .join('')
  const rooms = ground.rooms
    .map((r) => {
      const x = r.polygon.reduce((s, p) => s + p.x, 0) / r.polygon.length,
        z = r.polygon.reduce((s, p) => s + p.z, 0) / r.polygon.length
      return `<polygon points="${r.polygon.map((p) => `${p.x},${p.z}`).join(' ')}" fill="#e8e2d6" fill-opacity=".35" stroke="#b7afa0" stroke-width=".012"/>${labels ? `<text x="${x}" y="${z}" text-anchor="middle" font-family="Arial" font-size=".18" fill="#645e54">${r.name.replace(' / ', ' / ')}</text>` : ''}`
    })
    .join('')
  const doors = ground.doors
    .map((d) => {
      const w = ground.walls.find((w) => w.id === d.wallId)!,
        a = atWall(w, d.offset),
        angle = (Math.atan2(w.end.z - w.start.z, w.end.x - w.start.x) * 180) / Math.PI
      return `<g transform="translate(${a.x} ${a.z}) rotate(${angle})"><path d="M0,0L0,${d.width}M0,${d.width}A${d.width},${d.width} 0 0 0 ${d.width},0" fill="none" stroke="#92816a" stroke-width=".018"/></g>`
    })
    .join('')
  const steps = (ground.stairs || [])
    .flatMap((stair) =>
      stairSteps(stair, building.levels).map((step) => {
        const a = localToWorld(stair, step.u, step.v - step.width / 2),
          b = localToWorld(stair, step.u, step.v + step.width / 2)
        return `<path d="M${a.x},${a.z}L${b.x},${b.z}" stroke="#7f796e" stroke-width=".02"/>`
      }),
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-.6 -.6 13.2 11.2"><rect x="-.6" y="-.6" width="13.2" height="11.2" fill="#f3f0ea"/>${rooms}<g fill="none" stroke="#343a34">${walls}${windows}${doors}${steps}</g></svg>`
}
export const PLAN_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(planSvg())}`
