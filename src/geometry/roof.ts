import type { Roof } from '../domain/types'

export type Vertex = [number, number, number]
export type RoofFace = Vertex[]
export type RoofBounds = { minX: number; maxX: number; minZ: number; maxZ: number; top: number }
export type RoofLayout = { faces: RoofFace[]; gables: RoofFace[]; eaves: [Vertex, Vertex][]; ridge: [Vertex, Vertex][] }

export function roofLayout(bounds: RoofBounds, roof: Roof): RoofLayout {
  const { minX, maxX, minZ, maxZ, top } = bounds
  const x0 = minX - roof.overhang, x1 = maxX + roof.overhang
  const z0 = minZ - roof.overhang, z1 = maxZ + roof.overhang
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2
  const pitch = Math.tan(roof.pitch * Math.PI / 180)
  const eave = top + .12
  const p = (x: number, y: number, z: number): Vertex => [x, y, z]
  if (roof.shape === 'hidden') {
    const face = [p(x0, eave, z0), p(x1, eave, z0), p(x1, eave, z1), p(x0, eave, z1)]
    return { faces: [face], gables: [], eaves: [[face[0], face[1]], [face[1], face[2]], [face[2], face[3]], [face[3], face[0]]], ridge: [] }
  }
  if (roof.shape === 'shed') {
    const alongX = x1 - x0 <= z1 - z0
    const rise = Math.min((alongX ? x1 - x0 : z1 - z0) * pitch, 3.8)
    const heightAt = (value: number) => eave + rise * (value - (alongX ? x0 : z0)) / (alongX ? x1 - x0 : z1 - z0)
    const face = alongX
      ? [p(x0, eave, z0), p(x1, eave + rise, z0), p(x1, eave + rise, z1), p(x0, eave, z1)]
      : [p(x0, eave, z0), p(x1, eave, z0), p(x1, eave + rise, z1), p(x0, eave + rise, z1)]
    const gables = alongX ? [
      [p(minX, top, minZ), p(maxX, top, minZ), p(maxX, heightAt(maxX), minZ), p(minX, heightAt(minX), minZ)],
      [p(minX, top, maxZ), p(maxX, top, maxZ), p(maxX, heightAt(maxX), maxZ), p(minX, heightAt(minX), maxZ)],
      [p(maxX, top, minZ), p(maxX, top, maxZ), p(maxX, heightAt(maxX), maxZ), p(maxX, heightAt(maxX), minZ)],
    ] : [
      [p(minX, top, minZ), p(minX, top, maxZ), p(minX, heightAt(maxZ), maxZ), p(minX, heightAt(minZ), minZ)],
      [p(maxX, top, minZ), p(maxX, top, maxZ), p(maxX, heightAt(maxZ), maxZ), p(maxX, heightAt(minZ), minZ)],
      [p(minX, top, maxZ), p(maxX, top, maxZ), p(maxX, heightAt(maxZ), maxZ), p(minX, heightAt(maxZ), maxZ)],
    ]
    return { faces: [face], gables, eaves: [[face[0], face[1]], [face[1], face[2]], [face[2], face[3]], [face[3], face[0]]], ridge: [] }
  }
  const alongX = x1 - x0 >= z1 - z0
  if (roof.shape === 'gable') {
    const rise = (alongX ? (z1 - z0) / 2 : (x1 - x0) / 2) * pitch
    const y = eave + rise
    if (alongX) {
      const a = p(x0, y, mz), b = p(x1, y, mz)
      return { faces: [
        [p(x0, eave, z0), p(x1, eave, z0), b, a],
        [a, b, p(x1, eave, z1), p(x0, eave, z1)],
      ], gables: [[p(x0, eave, z0), a, p(x0, eave, z1)], [p(x1, eave, z0), b, p(x1, eave, z1)]],
      eaves: [[p(x0, eave, z0), p(x1, eave, z0)], [p(x0, eave, z1), p(x1, eave, z1)]], ridge: [[a, b]] }
    }
    const a = p(mx, y, z0), b = p(mx, y, z1)
    return { faces: [
      [p(x0, eave, z0), a, b, p(x0, eave, z1)],
      [a, p(x1, eave, z0), p(x1, eave, z1), b],
    ], gables: [[p(x0, eave, z0), a, p(x1, eave, z0)], [p(x0, eave, z1), b, p(x1, eave, z1)]],
    eaves: [[p(x0, eave, z0), p(x0, eave, z1)], [p(x1, eave, z0), p(x1, eave, z1)]], ridge: [[a, b]] }
  }
  const half = alongX ? (z1 - z0) / 2 : (x1 - x0) / 2
  const rise = half * pitch, y = eave + rise
  if (alongX) {
    const a = p(x0 + half, y, mz), b = p(x1 - half, y, mz)
    return { faces: [
      [p(x0, eave, z0), p(x1, eave, z0), b, a],
      [a, b, p(x1, eave, z1), p(x0, eave, z1)],
      [p(x0, eave, z0), a, p(x0, eave, z1)],
      [p(x1, eave, z0), p(x1, eave, z1), b],
    ], gables: [], eaves: [
      [p(x0, eave, z0), p(x1, eave, z0)], [p(x1, eave, z0), p(x1, eave, z1)],
      [p(x1, eave, z1), p(x0, eave, z1)], [p(x0, eave, z1), p(x0, eave, z0)],
    ], ridge: [[a, b]] }
  }
  const a = p(mx, y, z0 + half), b = p(mx, y, z1 - half)
  return { faces: [
    [p(x0, eave, z0), a, b, p(x0, eave, z1)],
    [a, p(x1, eave, z0), p(x1, eave, z1), b],
    [p(x0, eave, z0), p(x1, eave, z0), a],
    [p(x0, eave, z1), b, p(x1, eave, z1)],
  ], gables: [], eaves: [
    [p(x0, eave, z0), p(x1, eave, z0)], [p(x1, eave, z0), p(x1, eave, z1)],
    [p(x1, eave, z1), p(x0, eave, z1)], [p(x0, eave, z1), p(x0, eave, z0)],
  ], ridge: [[a, b]] }
}
