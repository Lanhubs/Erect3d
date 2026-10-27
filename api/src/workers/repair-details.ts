import type { IntelligenceInput } from '../modules/ai/provider'
import type { Intelligence } from '../contracts/analysis'
import type { ModelQuality } from '../modules/plan-analysis/quality'
import { repairContext } from './repair-context'
import { prepareAiImage } from './ai-image'
import { labelRepairTargets } from './label-targets'

// Keep the full original and add a bounded number of lossless native-pixel
// close-ups. Quadrants alone leave small door jambs hard to distinguish.
export async function repairSourceContext(
  source: IntelligenceInput,
  proposal: Intelligence,
  quality: ModelQuality,
): Promise<IntelligenceInput> {
  const context = repairContext(source, proposal, quality)
  const failed = new Set(
    quality.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.candidateId),
  )
  const targets = [
    ...proposal.candidates.filter((candidate) => failed.has(candidate.id)),
    ...labelRepairTargets(proposal, failed),
  ]
  const regions: NonNullable<IntelligenceInput['details']>[number]['region'][] = []
  for (const target of targets) {
    if (target.points.length < 2 || regions.length === 4) continue
    const xs = target.points.map((point) => point.x * source.width),
      ys = target.points.map((point) => point.y * source.height)
    const padding = Math.max(
      32,
      Math.min(160, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))),
    )
    const left = Math.max(0, Math.floor(Math.min(...xs) - padding)),
      top = Math.max(0, Math.floor(Math.min(...ys) - padding)),
      right = Math.min(source.width, Math.ceil(Math.max(...xs) + padding)),
      bottom = Math.min(source.height, Math.ceil(Math.max(...ys) + padding))
    const region = {
      x: left / source.width,
      y: top / source.height,
      width: (right - left) / source.width,
      height: (bottom - top) / source.height,
    }
    if (
      !regions.some(
        (prior) =>
          Math.abs(prior.x - region.x) * source.width < 16 &&
          Math.abs(prior.y - region.y) * source.height < 16,
      )
    )
      regions.push(region)
  }
  if (!regions.length) return context
  const details = []
  for (const region of regions) details.push({ ...(await prepareAiImage(source.bytes, region)), region })
  return { ...context, details }
}
