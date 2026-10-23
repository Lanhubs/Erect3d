import { BufferGeometry, BufferAttribute } from 'three'
import type { ArchitectureVision } from '../domain/architectureTypes'
import { arenaCanopyBuffers, type CanopyBuffers, type CanopyParameters } from './arenaCanopyBuffers'
export function canopyGeometry(buffers: CanopyBuffers) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(buffers.positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(buffers.uvs, 2))
  geometry.setAttribute('normal', new BufferAttribute(buffers.normals, 3))
  geometry.setIndex(new BufferAttribute(buffers.indices, 1))
  let offset = 0
  buffers.regions.forEach((count, slot) => {
    if (count) geometry.addGroup(offset, count, slot)
    offset += count
  })
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
export function canopyParameters(
  vision: ArchitectureVision,
  top: number,
  segments = 96,
  rows = 28,
): CanopyParameters {
  return {
    radiusX: vision.radiusX,
    radiusZ: vision.radiusZ,
    center: vision.center,
    rotation: vision.rotation,
    rise: vision.brief.roofRise,
    coverage: vision.brief.roofCoverage,
    top,
    segments,
    rows,
  }
}
export function arenaCanopy(vision: ArchitectureVision, top: number) {
  return canopyGeometry(arenaCanopyBuffers(canopyParameters(vision, top)))
}
