import type { Bounds } from './types'
export function boundsOf(points: { x: number; z: number }[], padding = 0): Bounds {
  return { minX: Math.min(...points.map(p => p.x)) - padding, maxX: Math.max(...points.map(p => p.x)) + padding,
    minZ: Math.min(...points.map(p => p.z)) - padding, maxZ: Math.max(...points.map(p => p.z)) + padding }
}
export class SpatialIndex<T extends Bounds> {
  private cells = new Map<string, T[]>()
  private large: T[] = []
  private size: number
  constructor(items: T[], size = 2) {
    this.size = size
    for (const item of items) {
      const x0 = Math.floor(item.minX / size), x1 = Math.floor(item.maxX / size), z0 = Math.floor(item.minZ / size), z1 = Math.floor(item.maxZ / size)
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 2048) { this.large.push(item); continue }
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const key = `${x}:${z}`, list = this.cells.get(key) || []; list.push(item); this.cells.set(key, list)
      }
    }
  }
  query(x: number, z: number, radius = .3) {
    const unique = new Set(this.large)
    for (let a = Math.floor((x - radius) / this.size); a <= Math.floor((x + radius) / this.size); a++)
      for (let b = Math.floor((z - radius) / this.size); b <= Math.floor((z + radius) / this.size); b++)
        for (const item of this.cells.get(`${a}:${b}`) || []) unique.add(item)
    return [...unique].filter(item => x + radius >= item.minX && x - radius <= item.maxX && z + radius >= item.minZ && z - radius <= item.maxZ)
  }
}
