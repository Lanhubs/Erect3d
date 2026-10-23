import type { Candidate } from '../../../api/src/contracts/analysis'
import type { Point } from '../domain/types'
import type { FurnitureType } from '../furniture/types'
import { estimatedVariant, furnitureDimensions, variants } from '../furniture/entities'
export function candidateFurniture(candidate: Candidate, points: Point[], type: FurnitureType) {
  const xs = points.map((p) => p.x),
    zs = points.map((p) => p.z)
  const position = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
  const rotation = candidate.furnitureRotation || 0,
    angle = (-rotation * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle)
  const local = points.map((p) => ({
    x: (p.x - position.x) * c - (p.z - position.z) * s,
    z: (p.x - position.x) * s + (p.z - position.z) * c,
  }))
  const width = Math.max(...local.map((p) => p.x)) - Math.min(...local.map((p) => p.x)),
    depth = Math.max(...local.map((p) => p.z)) - Math.min(...local.map((p) => p.z))
  const assetId =
    candidate.furnitureVariant && variants(type).includes(candidate.furnitureVariant)
      ? candidate.furnitureVariant
      : estimatedVariant(type, width)
  return {
    position,
    rotation,
    width,
    depth,
    assetId,
    height: candidate.heightMetres || furnitureDimensions(type, assetId)[2],
  }
}
