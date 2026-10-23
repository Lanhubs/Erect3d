import type { Roof } from '../domain/types'
import { crossRoofLayout } from './crossRoof'

export type Vertex = [number, number, number]
export type RoofFace = Vertex[]
export type RoofBounds = { minX: number; maxX: number; minZ: number; maxZ: number; top: number }
export type RoofLayout = {
  faces: RoofFace[]
  gables: RoofFace[]
  eaves: [Vertex, Vertex][]
  ridge: [Vertex, Vertex][]
}

export function roofLayout(bounds: RoofBounds, roof: Roof): RoofLayout {
  const { minX, maxX, minZ, maxZ, top } = bounds
  const x0 = minX - roof.overhang,
    x1 = maxX + roof.overhang
  const z0 = minZ - roof.overhang,
    z1 = maxZ + roof.overhang
  const mx = (x0 + x1) / 2,
    mz = (z0 + z1) / 2
  const pitch = Math.tan((roof.pitch * Math.PI) / 180)
  const eave = top + (roof.elevationOffset || 0) + 0.12
  const p = (x: number, y: number, z: number): Vertex => [x, y, z]
  if (roof.shape === 'cross-gable' || roof.shape === 'cross-hip') {
    return crossRoofLayout(bounds, roof)
  }
  if (roof.shape === 'hidden' || roof.shape === 'terrace') {
    const face = [p(x0, eave, z0), p(x1, eave, z0), p(x1, eave, z1), p(x0, eave, z1)]
    return {
      faces: [face],
      gables: [],
      eaves: [
        [face[0], face[1]],
        [face[1], face[2]],
        [face[2], face[3]],
        [face[3], face[0]],
      ],
      ridge: [],
    }
  }
  if (roof.shape === 'arena-vault') {
    const alongX = roof.ridgeDirection === 'x' || (roof.ridgeDirection !== 'z' && x1 - x0 >= z1 - z0)
    const span = alongX ? z1 - z0 : x1 - x0,
      half = span / 2
    const rise = Math.max(1.2, Math.min(half * Math.max(0.2, pitch * 1.15), 18))
    const steps = 12
    const faces: RoofFace[] = []
    const arcPoints: Array<{ y: number; s: number }> = []
    for (let i = 0; i <= steps; i++) {
      const norm = -1 + 2 * (i / steps)
      const y = eave + rise * (1 - norm * norm)
      const s = (alongX ? mz : mx) + norm * half
      arcPoints.push({ y, s })
    }
    for (let i = 0; i < steps; i++) {
      const a = arcPoints[i],
        b = arcPoints[i + 1]
      faces.push(
        alongX
          ? [p(x0, a.y, a.s), p(x1, a.y, a.s), p(x1, b.y, b.s), p(x0, b.y, b.s)]
          : [p(a.s, a.y, z0), p(b.s, b.y, z0), p(b.s, b.y, z1), p(a.s, a.y, z1)],
      )
    }
    const peak = eave + rise
    const ridge: [Vertex, Vertex][] = alongX
      ? [[p(x0, peak, mz), p(x1, peak, mz)]]
      : [[p(mx, peak, z0), p(mx, peak, z1)]]
    const eaves: [Vertex, Vertex][] = alongX
      ? [
          [p(x0, eave, z0), p(x1, eave, z0)],
          [p(x1, eave, z1), p(x0, eave, z1)],
        ]
      : [
          [p(x0, eave, z0), p(x0, eave, z1)],
          [p(x1, eave, z1), p(x1, eave, z0)],
        ]
    const gables: RoofFace[] = alongX
      ? [
          [p(minX, top, minZ), ...arcPoints.map((pt) => p(minX, pt.y, pt.s)), p(minX, top, maxZ)],
          [
            p(maxX, top, maxZ),
            ...[...arcPoints].reverse().map((pt) => p(maxX, pt.y, pt.s)),
            p(maxX, top, minZ),
          ],
        ]
      : [
          [p(minX, top, minZ), ...arcPoints.map((pt) => p(pt.s, pt.y, minZ)), p(maxX, top, minZ)],
          [
            p(maxX, top, maxZ),
            ...[...arcPoints].reverse().map((pt) => p(pt.s, pt.y, maxZ)),
            p(minX, top, maxZ),
          ],
        ]
    return { faces, gables, eaves, ridge }
  }
  if (roof.shape === 'shed') {
    const alongX = roof.ridgeDirection === 'z' || (roof.ridgeDirection !== 'x' && x1 - x0 <= z1 - z0)
    const rise = Math.min((alongX ? x1 - x0 : z1 - z0) * pitch, 3.8)
    const heightAt = (value: number) =>
      eave + (rise * (value - (alongX ? x0 : z0))) / (alongX ? x1 - x0 : z1 - z0)
    const face = alongX
      ? [p(x0, eave, z0), p(x1, eave + rise, z0), p(x1, eave + rise, z1), p(x0, eave, z1)]
      : [p(x0, eave, z0), p(x1, eave, z0), p(x1, eave + rise, z1), p(x0, eave + rise, z1)]
    const gables = alongX
      ? [
          [
            p(minX, top, minZ),
            p(maxX, top, minZ),
            p(maxX, heightAt(maxX), minZ),
            p(minX, heightAt(minX), minZ),
          ],
          [
            p(minX, top, maxZ),
            p(maxX, top, maxZ),
            p(maxX, heightAt(maxX), maxZ),
            p(minX, heightAt(minX), maxZ),
          ],
          [
            p(maxX, top, minZ),
            p(maxX, top, maxZ),
            p(maxX, heightAt(maxX), maxZ),
            p(maxX, heightAt(maxX), minZ),
          ],
        ]
      : [
          [
            p(minX, top, minZ),
            p(minX, top, maxZ),
            p(minX, heightAt(maxZ), maxZ),
            p(minX, heightAt(minZ), minZ),
          ],
          [
            p(maxX, top, minZ),
            p(maxX, top, maxZ),
            p(maxX, heightAt(maxZ), maxZ),
            p(maxX, heightAt(minZ), minZ),
          ],
          [
            p(minX, top, maxZ),
            p(maxX, top, maxZ),
            p(maxX, heightAt(maxZ), maxZ),
            p(minX, heightAt(maxZ), maxZ),
          ],
        ]
    return {
      faces: [face],
      gables,
      eaves: [
        [face[0], face[1]],
        [face[1], face[2]],
        [face[2], face[3]],
        [face[3], face[0]],
      ],
      ridge: [],
    }
  }
  const alongX = roof.ridgeDirection === 'x' || (roof.ridgeDirection !== 'z' && x1 - x0 >= z1 - z0)
  if (roof.shape === 'butterfly') {
    const rise = Math.min(((alongX ? z1 - z0 : x1 - x0) / 2) * pitch, 4)
    const high = eave + rise
    const a = alongX ? p(x0, eave, mz) : p(mx, eave, z0)
    const b = alongX ? p(x1, eave, mz) : p(mx, eave, z1)
    const left = alongX ? [p(x0, high, z0), p(x1, high, z0), b, a] : [p(x0, high, z0), a, b, p(x0, high, z1)]
    const right = alongX ? [a, b, p(x1, high, z1), p(x0, high, z1)] : [a, p(x1, high, z0), p(x1, high, z1), b]
    return { faces: [left, right], gables: [], eaves: [], ridge: [[a, b]] }
  }
  if (roof.shape === 'mansard') {
    const inset = Math.min(x1 - x0, z1 - z0) * 0.18
    const y = eave + Math.min(inset * pitch * 1.6, 3.8)
    const a = p(x0 + inset, y, z0 + inset),
      b = p(x1 - inset, y, z0 + inset)
    const c = p(x1 - inset, y, z1 - inset),
      d = p(x0 + inset, y, z1 - inset)
    return {
      faces: [
        [p(x0, eave, z0), p(x1, eave, z0), b, a],
        [b, p(x1, eave, z0), p(x1, eave, z1), c],
        [d, c, p(x1, eave, z1), p(x0, eave, z1)],
        [p(x0, eave, z0), a, d, p(x0, eave, z1)],
        [a, b, c, d],
      ],
      gables: [],
      eaves: [
        [p(x0, eave, z0), p(x1, eave, z0)],
        [p(x1, eave, z0), p(x1, eave, z1)],
        [p(x1, eave, z1), p(x0, eave, z1)],
        [p(x0, eave, z1), p(x0, eave, z0)],
      ],
      ridge: [],
    }
  }
  if (roof.shape === 'gable') {
    const rise = (alongX ? (z1 - z0) / 2 : (x1 - x0) / 2) * pitch
    const y = eave + rise
    if (alongX) {
      const a = p(x0, y, mz),
        b = p(x1, y, mz)
      return {
        faces: [
          [p(x0, eave, z0), p(x1, eave, z0), b, a],
          [a, b, p(x1, eave, z1), p(x0, eave, z1)],
        ],
        gables: [
          [p(x0, eave, z0), a, p(x0, eave, z1)],
          [p(x1, eave, z0), b, p(x1, eave, z1)],
        ],
        eaves: [
          [p(x0, eave, z0), p(x1, eave, z0)],
          [p(x0, eave, z1), p(x1, eave, z1)],
        ],
        ridge: [[a, b]],
      }
    }
    const a = p(mx, y, z0),
      b = p(mx, y, z1)
    return {
      faces: [
        [p(x0, eave, z0), a, b, p(x0, eave, z1)],
        [a, p(x1, eave, z0), p(x1, eave, z1), b],
      ],
      gables: [
        [p(x0, eave, z0), a, p(x1, eave, z0)],
        [p(x0, eave, z1), b, p(x1, eave, z1)],
      ],
      eaves: [
        [p(x0, eave, z0), p(x0, eave, z1)],
        [p(x1, eave, z0), p(x1, eave, z1)],
      ],
      ridge: [[a, b]],
    }
  }
  const half = alongX ? (z1 - z0) / 2 : (x1 - x0) / 2
  const rise = half * pitch,
    y = eave + rise
  if (alongX) {
    const a = p(x0 + half, y, mz),
      b = p(x1 - half, y, mz)
    return {
      faces: [
        [p(x0, eave, z0), p(x1, eave, z0), b, a],
        [a, b, p(x1, eave, z1), p(x0, eave, z1)],
        [p(x0, eave, z0), a, p(x0, eave, z1)],
        [p(x1, eave, z0), p(x1, eave, z1), b],
      ],
      gables: [],
      eaves: [
        [p(x0, eave, z0), p(x1, eave, z0)],
        [p(x1, eave, z0), p(x1, eave, z1)],
        [p(x1, eave, z1), p(x0, eave, z1)],
        [p(x0, eave, z1), p(x0, eave, z0)],
      ],
      ridge: [[a, b]],
    }
  }
  const a = p(mx, y, z0 + half),
    b = p(mx, y, z1 - half)
  return {
    faces: [
      [p(x0, eave, z0), a, b, p(x0, eave, z1)],
      [a, p(x1, eave, z0), p(x1, eave, z1), b],
      [p(x0, eave, z0), p(x1, eave, z0), a],
      [p(x0, eave, z1), b, p(x1, eave, z1)],
    ],
    gables: [],
    eaves: [
      [p(x0, eave, z0), p(x1, eave, z0)],
      [p(x1, eave, z0), p(x1, eave, z1)],
      [p(x1, eave, z1), p(x0, eave, z1)],
      [p(x0, eave, z1), p(x0, eave, z0)],
    ],
    ridge: [[a, b]],
  }
}
