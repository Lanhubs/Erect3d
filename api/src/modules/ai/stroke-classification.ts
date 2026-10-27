import type { Candidate } from '../../contracts/analysis'
export function confirmedSourceSymbols(refs: string[] = [], measured: Candidate[]) {
  return [...new Set(refs)].map((id) => {
    const detail = measured.find(
      (item) => item.id === id && /^cv_detail_/.test(id) && ['stair', 'column'].includes(item.kind),
    )
    if (!detail) throw new Error('Unknown structural symbol reference')
    return { ...detail, confidence: Math.max(0.8, detail.confidence), needsReview: true as const }
  })
}
type Classification = {
  classification?: 'wall-refs-v1'
  strokeLabels?: Record<string, string>
  wallRefs?: number[]
  uncertainWallRefs?: number[]
}
// Reference lists encode the same full wall/non-wall classification without
// asking a model to count exact 25-character strings on hundreds of strokes.
export function classifyStrokes(parsed: Classification, count: number) {
  if (
    [...(parsed.wallRefs || []), ...(parsed.uncertainWallRefs || [])].some(
      (ref) => ref >= count || ref < 0 || !Number.isInteger(ref),
    )
  )
    throw new Error('Unknown measured wall reference')
  let labels: string[]
  if (parsed.classification === 'wall-refs-v1') {
    if (!parsed.wallRefs) throw new Error('Confirmed wall references are required')
    const confirmed = new Set(parsed.wallRefs),
      uncertain = new Set(parsed.uncertainWallRefs || [])
    if ([...uncertain].some((ref) => confirmed.has(ref)))
      throw new Error('A wall reference cannot be both confirmed and uncertain')
    labels = Array.from({ length: count }, (_, ref) =>
      confirmed.has(ref) ? '1' : uncertain.has(ref) ? '2' : '0',
    )
  } else {
    const groups = Array.from({ length: Math.ceil(count / 25) }, (_, index) => index * 25)
    if (
      !parsed.strokeLabels ||
      Object.keys(parsed.strokeLabels).length !== groups.length ||
      groups.some((start) => parsed.strokeLabels![String(start)]?.length !== Math.min(25, count - start))
    )
      throw new Error('Every source measurement requires classification')
    labels = Array.from(
      { length: count },
      (_, ref) => parsed.strokeLabels![String(Math.floor(ref / 25) * 25)][ref % 25],
    )
  }
  return {
    labels,
    selected: [
      ...new Set([
        ...labels.flatMap((label, ref) => (label === '1' ? [ref] : [])),
        ...(parsed.wallRefs || []),
      ]),
    ],
  }
}
