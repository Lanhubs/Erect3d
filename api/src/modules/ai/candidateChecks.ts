import type { Candidate } from '../../contracts/analysis'
export type ImageScale = { width: number; height: number; metresPerPixel: number }
export function checkCandidate(candidate: Candidate, scale?: ImageScale): Candidate {
  const result = structuredClone(candidate), problems: string[] = []
  if (candidate.curve) {
    if (candidate.kind !== 'wall' || candidate.points.length !== 2) problems.push('Arc requires a wall with two endpoints')
    if (scale) for (const point of candidate.points) {
      const radius = Math.hypot((point.x - candidate.curve.center.x) * scale.width,
        (point.y - candidate.curve.center.y) * scale.height)
      if (Math.abs(radius - candidate.curve.radius * scale.width) > Math.max(2, candidate.curve.radius * scale.width * .03)) {
        problems.push('Arc endpoints disagree with the measured radius'); break
      }
    }
  }
  if (['room', 'void', 'column'].includes(candidate.kind) && candidate.points.length >= 3) {
    const area = Math.abs(candidate.points.reduce((sum, point, i) => {
      const next = candidate.points[(i + 1) % candidate.points.length]
      return sum + point.x * next.y - next.x * point.y
    }, 0)) / 2
    if (area < .000001) problems.push('Polygon has no usable area')
  }
  if (scale) {
    const metresWide = scale.width * scale.metresPerPixel
    if (candidate.thickness && (candidate.thickness * metresWide < .05 || candidate.thickness * metresWide > 1.5)) {
      problems.push('Wall thickness is implausible at the current scale; verify scale and measurement')
    }
    if (['door', 'window', 'passage'].includes(candidate.kind) && candidate.points.length === 2) {
      const [a, b] = candidate.points
      const width = Math.hypot((b.x - a.x) * scale.width, (b.y - a.y) * scale.height) * scale.metresPerPixel
      if (width < .25 || width > 8) problems.push('Opening width is implausible at the current scale')
    }
  }
  if (problems.length) {
    result.confidence = Math.min(result.confidence, .35)
    result.uncertainties = [...new Set([...result.uncertainties, ...problems])].slice(0, 20)
  }
  return result
}
