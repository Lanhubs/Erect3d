import type { ReactNode } from 'react'
import type { Project } from '../domain/types'
import type { ReviewView } from '../features/plan/ReviewLayer'

export type WorkspaceProps = {
  project: Project
  back: () => void
  onBackendAnalysis?: () => void
  reconstructing?: boolean
  statusContent?: ReactNode
  collaborate?: () => void
  assistant?: () => void
  assistantOpen?: boolean
  previewing?: boolean
  previewControls?: ReactNode
  previewLevelId?: string
  wholeBuildingRequest?: string
}
export const defaultReviewView: ReviewView = {
  source: true,
  walls: true,
  openings: true,
  spaces: true,
  details: true,
  opacity: 0.55,
}
