import type { Level } from '../domain/types'
import { furnitureParts } from './assets'
import type { SoftwareFace } from '../rendering/softwareDetails'
import type { Vertex } from '../geometry/roof'
export function softwareFurniture(level: Level): SoftwareFace[] {
  return (level.furniture || []).flatMap(object => furnitureParts(object).flatMap((part, index) => {
    const angle = object.rotation * Math.PI / 180
    const vertex = (x: number, y: number, z: number): Vertex => [object.position.x + x * Math.cos(angle) - z * Math.sin(angle), y, object.position.z + x * Math.sin(angle) + z * Math.cos(angle)]
    const [x, y, z] = part.at, [w, h, d] = part.size
    const corners = [-1, 1].flatMap(a => [-1, 1].flatMap(b => [-1, 1].map(c => vertex(x + a * w / 2, y + b * h / 2, z + c * d / 2))))
    return [[0, 1, 3, 2], [1, 3, 7, 5], [2, 3, 7, 6]].map((face, i) => { const vertices = face.map(j => corners[j])
      return { key: `${object.id}:${index}:${i}`, vertices, fill: part.color, stroke: '#827e72', depth: vertices.reduce((sum, p) => sum + p[0] + p[2], 0) / 4,
        select: { kind: 'furniture' as const, id: object.id } } })
  }))
}
