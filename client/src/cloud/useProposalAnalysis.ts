import { useEffect } from 'react'
import { api } from './api'
import { getTask } from './cache'
import { watchAnalysis } from './watchAnalysis'
import type { Acceptance, Analysis } from './proposalReviewModel'
/**
 * Follows one analysis until it finishes and restores the acceptance this tab already started, so a
 * reload cannot lose a partially applied proposal.
 */
export function useProposalAnalysis(input: {
  projectId: string
  analysisId: string
  taskKey: string
  receive: (result: Analysis) => void
  restore: (task?: Acceptance) => void
  fail: (message: string) => void
}) {
  const { projectId, analysisId, taskKey, receive, restore, fail } = input
  useEffect(() => {
    let alive = true
    const stop = watchAnalysis(
      projectId,
      analysisId,
      () => api.request<Analysis>(`/analysis/${analysisId}`),
      receive,
      (error) => fail(error.message),
    )
    getTask<Acceptance>(taskKey)
      .then((task) => {
        if (alive) restore(task)
      })
      .catch((error) => {
        if (alive) fail(error.message)
      })
    return () => {
      alive = false
      stop()
    }
  }, [analysisId, taskKey])
}
