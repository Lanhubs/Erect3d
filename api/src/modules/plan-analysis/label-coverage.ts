import type { Intelligence, Candidate } from '../../contracts/analysis'
import type { SourceLabel } from '../../contracts/source-text'
import type { ModelQuality } from './quality'
import { containsPoint } from '../../../../client/src/geometry/polygons'

const name = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
function textBox(label: SourceLabel, candidate: Candidate) {
  if (candidate.kind !== 'room' || candidate.points.length < 3) return false
  const xs = candidate.points.map((point) => point.x),
    ys = candidate.points.map((point) => point.y)
  const b = label.bounds,
    tolerance = Math.min(b.width, b.height) * 0.1
  return (
    Math.abs(Math.min(...xs) - b.x) <= tolerance &&
    Math.abs(Math.min(...ys) - b.y) <= tolerance &&
    Math.abs(Math.max(...xs) - b.x - b.width) <= tolerance &&
    Math.abs(Math.max(...ys) - b.y - b.height) <= tolerance
  )
}
function located(label: SourceLabel, candidate: Candidate, aspect = 1) {
  const p = { x: label.bounds.x + label.bounds.width / 2, z: label.bounds.y + label.bounds.height / 2 }
  if (
    candidate.points.length >= 3 &&
    containsPoint(
      candidate.points.map((p) => ({ x: p.x, z: p.y })),
      p,
    )
  )
    return true
  if (candidate.curve) {
    const curve = candidate.curve,
      rx = curve.radius,
      ry = curve.radius * aspect
    return rx > 0 && ry > 0 && ((p.x - curve.center.x) / rx) ** 2 + ((p.z - curve.center.y) / ry) ** 2 <= 1
  }
  return candidate.points.some(
    (point) =>
      Math.abs(point.x - p.x) <= label.bounds.width && Math.abs(point.y - p.z) <= label.bounds.height * 2,
  )
}
export function labelCoverage(
  proposal: Intelligence,
  dimensions?: { width: number; height: number },
): ModelQuality['issues'] {
  const source = proposal.sourceText
  if (!source) return []
  const issues: ModelQuality['issues'] = []
  const add = (
    code: string,
    message: string,
    candidateId?: string,
    severity: 'warning' | 'error' = 'warning',
  ) => issues.push({ code, message, candidateId, severity })
  if (source.status !== 'ready')
    add(
      'SOURCE_TEXT_INCOMPLETE',
      'Local text reading was incomplete. Inspect unclear source labels before treating the drawing as fully covered.',
    )
  const allowed = new Set(['room', 'architectural-boundary', 'stair', 'void'])
  const spaces = proposal.candidates.filter((candidate) => allowed.has(candidate.kind))
  const owns = (label: SourceLabel, candidate: Candidate) =>
    located(label, candidate, dimensions ? dimensions.width / dimensions.height : 1)
  const readings = new Map((proposal.labelReadings || []).map((reading) => [reading.sourceId, reading]))
  if (readings.size !== (proposal.labelReadings || []).length) {
    const seen = new Set<string>()
    for (const reading of proposal.labelReadings || []) {
      if (seen.has(reading.sourceId))
        add(
          'SOURCE_LABEL_CONFLICT',
          `Source label ${reading.sourceId} has multiple competing interpretations. Resolve it explicitly before applying.`,
          reading.sourceId,
          'error',
        )
      seen.add(reading.sourceId)
    }
  }
  for (const label of source.items) {
    const reading = readings.get(label.id)
    if (reading?.role === 'space') {
      const owned = spaces.filter((candidate) => reading.candidateIds.includes(candidate.id))
      if (owned.length && owned.every((candidate) => textBox(label, candidate)))
        add(
          'SOURCE_LABEL_AS_GEOMETRY',
          `The area “${reading.reading}” follows its OCR text box instead of a source enclosure. Trace the actual room walls and floor.`,
          label.id,
          'error',
        )
      else if (!owned.some((candidate) => owns(label, candidate)))
        add(
          label.confidence < 0.7 ? 'SOURCE_TEXT_UNCLEAR' : 'SOURCE_SPACE_UNMODELED',
          label.confidence < 0.7
            ? `Uncertain OCR text “${label.text}” was interpreted as “${reading.reading}” away from its source location. Verify this reading; its area is not confirmed.`
            : `Label “${reading.reading}” is a source architectural area without matching geometry at its printed location. Interpret its actual boundaries and access; do not use the text box as a room.`,
          label.id,
          label.confidence < 0.7 ? 'warning' : 'error',
        )
      else if (
        owned.every((candidate) => candidate.kind === 'room') &&
        !owned.some((candidate) => name(candidate.label || '').includes(name(reading.reading)))
      )
        add(
          'SOURCE_SPACE_MISNAMED',
          `Source area “${reading.reading}” was replaced by another room name. Preserve the visible name or its explicitly verified reading, including uncommon names and numbered suites.`,
          label.id,
          'error',
        )
      continue
    }
    if (reading?.role === 'unreadable') {
      add(
        'SOURCE_TEXT_UNCLEAR',
        `The label near “${label.text}” needs reading against the original; its meaning is not confirmed.`,
        label.id,
      )
      continue
    }
    if (reading) continue
    // A literal source label already attached to the correctly located room is
    // accounted for even when an older/cached provider omits labelReadings.
    const literal = name(label.text)
    if (
      literal &&
      spaces.some((candidate) => name(candidate.label || '') === literal && owns(label, candidate))
    )
      continue
    add(
      'SOURCE_LABEL_UNACCOUNTED',
      `Source text “${label.text}” has not been accounted for at its printed location. Identify its area or explain why it is a dimension, annotation, title or site label.`,
      label.id,
    )
  }
  for (const reading of readings.values())
    if (!source.items.some((label) => label.id === reading.sourceId))
      add(
        'SOURCE_LABEL_UNKNOWN',
        'The provider referenced a text label absent from the original local inventory.',
        reading.sourceId,
        'error',
      )
  return issues
}
