import type { Point } from '../domain/types'
import type { Vertex } from '../geometry/roof'

export const projectSoftware = ([x, y, z]: Vertex, top: boolean) => top ? [x, z] : [(x - z) * .866, (x + z) * .5 - y * 1.15]
export function unprojectSoftware(x: number, y: number, height: number, top: boolean): Point {
  return top ? { x, z: y } : { x: x / 1.732 + y + height * 1.15, z: -x / 1.732 + y + height * 1.15 }
}
