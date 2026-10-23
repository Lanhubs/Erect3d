import type { OpeningCandidate, WorldFeature } from './openingCandidates'
import { dot, subtract } from './planLines'

export function openingEvidence(
  candidate: OpeningCandidate,
  features: WorldFeature[],
): Partial<OpeningCandidate> {
  const width = candidate.width,
    unit = {
      x: (candidate.end.x - candidate.start.x) / width,
      z: (candidate.end.z - candidate.start.z) / width,
    }
  const perpendicular = { x: -unit.z, z: unit.x }
  const local = features.map((feature) => {
    const a = subtract(feature.start, candidate.start),
      b = subtract(feature.end, candidate.start)
    return {
      feature,
      a: { x: dot(a, unit), z: dot(a, perpendicular) },
      b: { x: dot(b, unit), z: dot(b, perpendicular) },
    }
  })
  const swings = local.filter(
    ({ feature, a, b }) =>
      feature.kind === 'swing' &&
      Math.min(Math.abs(a.x), Math.abs(a.x - width)) < Math.min(0.3, width * 0.3) &&
      Math.abs(a.z) < 0.3 &&
      Math.hypot(b.x - a.x, b.z - a.z) >= width * 0.35 &&
      Math.hypot(b.x - a.x, b.z - a.z) <= width * 1.3,
  )
  if (swings.length)
    return {
      choice: 'door',
      confidence: 0.9,
      evidence: 'Door swing arc and leaf at a wall jamb',
      hinge: swings[0].a.x < width / 2 ? 'left' : 'right',
      doubleLeaf:
        swings.some((swing) => swing.a.x < width * 0.3) && swings.some((swing) => swing.a.x > width * 0.7),
    }
  const diagonal =
    width <= 1.8 &&
    local.find(({ feature, a, b }) => {
      if (feature.kind !== 'diagonal') return false
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      if (length < Math.max(0.25, width * 0.42) || length > width * 1.8) return false
      return [
        [a, b],
        [b, a],
      ].some(
        ([hinge, tip]) =>
          Math.min(Math.abs(hinge.x), Math.abs(hinge.x - width)) < Math.min(0.22, width * 0.24) &&
          Math.abs(hinge.z) < 0.18 &&
          Math.abs(tip.z) > 0.14 &&
          tip.x > width * 0.13 &&
          tip.x < width * 0.87,
      )
    })
  if (diagonal)
    return {
      choice: 'door',
      confidence: 0.78,
      evidence: 'Door leaf anchored at a wall jamb',
      hinge:
        Math.min(Math.abs(diagonal.a.x), Math.abs(diagonal.a.x - width)) <
        Math.min(Math.abs(diagonal.b.x), Math.abs(diagonal.b.x - width))
          ? diagonal.a.x < width / 2
            ? 'left'
            : 'right'
          : diagonal.b.x < width / 2
            ? 'left'
            : 'right',
    }
  const perpendicularLeaf =
    width >= 0.55 &&
    width <= 1.35 &&
    local.find(({ feature, a, b }) => {
      if (feature.kind === 'swing') return false
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      if (length < width * 0.75 || length > width * 1.2 || Math.abs(b.x - a.x) > length * 0.08) return false
      return [a, b].some(
        (hinge) =>
          Math.min(Math.abs(hinge.x), Math.abs(hinge.x - width)) < Math.min(0.12, width * 0.12) &&
          Math.abs(hinge.z) < 0.1,
      )
    })
  if (perpendicularLeaf)
    return {
      choice: 'door',
      confidence: 0.68,
      evidence: 'Thin perpendicular leaf at a wall jamb; verify the door',
      hinge: (perpendicularLeaf.a.x + perpendicularLeaf.b.x) / 2 < width / 2 ? 'left' : 'right',
    }
  const glazing = local.filter(
    ({ feature, a, b }) =>
      feature.kind !== 'swing' &&
      Math.abs(b.z - a.z) < 0.08 &&
      Math.abs(a.z) < 0.24 &&
      Math.min(a.x, b.x) >= -Math.max(0.12, width * 0.2) &&
      Math.max(a.x, b.x) <= width + Math.max(0.12, width * 0.2) &&
      Math.min(a.x, b.x) < width * 0.2 &&
      Math.max(a.x, b.x) > width * 0.8,
  )
  const distinctGlazing = glazing.some((first, index) =>
    glazing.slice(index + 1).some((second) => {
      const separation = Math.abs((first.a.z + first.b.z - second.a.z - second.b.z) / 2)
      const overlap =
        Math.min(Math.max(first.a.x, first.b.x), Math.max(second.a.x, second.b.x)) -
        Math.max(Math.min(first.a.x, first.b.x), Math.min(second.a.x, second.b.x))
      return separation > Math.max(0.006, width * 0.008) && overlap > width * 0.6
    }),
  )
  if (distinctGlazing)
    return {
      choice: 'window',
      confidence: 0.82,
      evidence: 'Distinct parallel glazing strokes across a wall gap',
    }
  return { choice: 'unknown', confidence: 0.35, evidence: 'Wall gap without a readable opening symbol' }
}
