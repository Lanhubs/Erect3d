import { useEffect, useRef } from 'react'
import { detailLossCodes, type Analysis } from './proposalReviewModel'
/**
 * An unattended reconstruction applies itself once, and only while nothing about it needs a human:
 * a clean, ready, full rebuild with something selected.
 */
export function useProposalAutoApply(input: {
  autoApply: boolean
  analysis?: Analysis
  rebuilding: boolean
  replaceLevel: boolean
  selectedCount: number
  readOnly: boolean
  apply: () => void
}) {
  const { autoApply, analysis, rebuilding, replaceLevel, selectedCount, readOnly, apply } = input
  const applied = useRef(false)
  useEffect(() => {
    if (
      !autoApply ||
      applied.current ||
      analysis?.status !== 'ready' ||
      analysis.result?.quality?.status === 'blocked' ||
      analysis.result?.quality?.issues.some((issue) => detailLossCodes.includes(issue.code)) ||
      !rebuilding ||
      !replaceLevel ||
      !selectedCount ||
      readOnly
    )
      return
    applied.current = true
    apply()
  }, [autoApply, analysis?.status, replaceLevel, selectedCount, readOnly])
}
