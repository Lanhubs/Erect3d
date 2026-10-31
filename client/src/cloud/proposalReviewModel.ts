import type { Candidate, Intelligence } from '../../../api/src/contracts/analysis'
import { buildableCandidates } from '../../../api/src/modules/plan-analysis/quality'
import type { Project } from '../domain/types'
export type Analysis = {
  status: string
  job_status: string
  created_at?: string
  options?: { engine?: string; purpose?: string }
  failure_code?: string
  progress?: { completed: string[]; stages: string[]; current: string }
  result?: {
    proposal: Intelligence
    quality?: { status: string; issues: { code: string; message: string; severity: string }[] }
  }
}
export type Acceptance = {
  operationId: string
  baseRevision: number
  candidateIds: string[]
  edits: Candidate[]
  allowConfirmedIds?: string[]
  designIds?: string[]
  replaceLevel?: boolean
  rejected?: boolean
  before?: Project
  historyRecorded?: boolean
}
/** The two server findings that mean a reconstruction is thinner than the model it replaces. */
export const detailLossCodes = ['DETAIL_REGRESSION', 'SOURCE_DETAIL_INCOMPLETE']

/** A result that cannot be applied safely has to say so in the same words the progress panel uses. */
export function reconstructionAdvice(result: Analysis): string | undefined {
  if (result.status !== 'ready') return undefined
  const blocking = result.result?.quality?.issues.find((issue) => issue.severity === 'error')
  if (blocking) return `Needs correction: ${blocking.message}. Nothing from this result has been applied.`
  if (result.result?.quality?.issues.some((issue) => detailLossCodes.includes(issue.code)))
    return 'Review needed: this reconstruction omits detail from the current model. Nothing from this result has been applied.'
  return undefined
}

/** A full rebuild preselects everything the server found buildable, except explicit removals. */
export const rebuildSelection = (candidates: Candidate[]) =>
  new Set(
    buildableCandidates(candidates)
      .filter((candidate) => candidate.action !== 'remove')
      .map((candidate) => candidate.id),
  )

/** Only one candidate may retarget an existing element, so choosing one drops its rivals. */
export function chooseCandidate(previous: Set<string>, candidate: Candidate, candidates: Candidate[]) {
  const next = new Set(previous)
  if (candidate.targetId)
    candidates.filter((item) => item.targetId === candidate.targetId).forEach((item) => next.delete(item.id))
  next.add(candidate.id)
  return next
}

export function toggleId(previous: Set<string>, id: string, checked: boolean) {
  const next = new Set(previous)
  if (checked) next.add(id)
  else next.delete(id)
  return next
}

/** The host wall list mixes existing walls with proposed ones so a candidate can be reassigned. */
export function wallChoices(walls: { id: string }[], candidates: Candidate[]) {
  return [
    ...new Map(
      [
        ...walls.map((wall) => ({ id: wall.id, label: undefined as string | undefined })),
        ...candidates
          .filter((candidate) => candidate.kind === 'wall')
          .map((candidate) => ({ id: candidate.id, label: candidate.label })),
      ].map((wall) => [wall.id, wall]),
    ).values(),
  ]
}

export const acceptanceInput = (input: {
  baseRevision: number
  candidates: Candidate[]
  selected: Set<string>
  allowConfirmed: Set<string>
  selectedDesigns: Set<string>
  replaceLevel: boolean
  before: Project
}): Acceptance => ({
  operationId: crypto.randomUUID(),
  baseRevision: input.baseRevision,
  candidateIds: [...input.selected],
  replaceLevel: input.replaceLevel,
  edits: input.candidates.filter((candidate) => input.selected.has(candidate.id)),
  allowConfirmedIds: [...input.allowConfirmed],
  designIds: [...input.selectedDesigns],
  before: input.before,
})

/** Every reason the panel refuses to send, kept away from the button so it can be tested alone. */
export function blocksAcceptance(input: {
  busy: boolean
  readOnly: boolean
  analysis?: Analysis
  acceptance?: Acceptance
  previewValid: boolean
  selectedCount: number
  designCount: number
  rebuilding: boolean
  replaceLevel: boolean
}) {
  const { busy, readOnly, analysis, acceptance, previewValid, selectedCount, designCount } = input
  return Boolean(
    busy ||
    readOnly ||
    analysis?.status === 'accepted' ||
    (analysis?.result?.quality?.status === 'blocked' && !previewValid) ||
    (!selectedCount && !designCount) ||
    selectedCount > 1000 ||
    Boolean(acceptance?.rejected) ||
    (input.rebuilding && !input.replaceLevel && !acceptance),
  )
}

export const applyLabel = (input: {
  busy: boolean
  status: string
  acceptance?: Acceptance
  rebuilding: boolean
  selectedCount: number
  designCount: number
}) =>
  input.busy
    ? 'Applying reconstruction…'
    : input.status === 'accepted'
      ? 'Applied to your model'
      : input.acceptance
        ? 'Retry applying reconstruction'
        : input.rebuilding
          ? 'Apply reconstruction to this floor'
          : `Accept ${input.selectedCount} model changes / ${input.designCount} designs`
