import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { type Calibration, type Level, type Project, type SourceDocument } from '../domain/types'
import { reusedGroundCalibration, setLevelCalibration } from '../domain/levelCalibration'
import { calibrate } from '../geometry/math'
import { initialAutoScale, setEstimatedSpan } from '../geometry/autoScale'
import { saveProject } from '../state/database'
import { useProject } from '../state/project'
import type { useAnalysis } from '../features/import/useAnalysis'
import type { WorkspaceMode } from './WorkspaceHeader'

export function usePlanAnalysis({
  acceptCandidates,
  analysis,
  backend,
  calibration,
  level,
  onBackendAnalysis,
  project,
  saveAutoScale,
  setManualScale,
  setSelectedDetection,
  setMode,
  setShowImport,
  source,
  url,
}: {
  acceptCandidates: (replace: boolean) => void
  analysis: ReturnType<typeof useAnalysis>
  backend: boolean
  calibration?: Calibration
  level: Level
  onBackendAnalysis?: () => void
  project: Project
  saveAutoScale: (estimate: Calibration) => void
  setManualScale: Dispatch<SetStateAction<boolean>>
  setSelectedDetection: Dispatch<SetStateAction<string | null>>
  setMode: Dispatch<SetStateAction<WorkspaceMode>>
  setShowImport: Dispatch<SetStateAction<boolean>>
  source?: SourceDocument
  url?: string
}) {
  const readOnly = useProject((s) => s.readOnly),
    setProject = useProject((s) => s.replaceDocument),
    setView = useProject((s) => s.setView)
  const autoStarted = useRef<string | null>(null),
    buildRequested = useRef(false)
  const applyCalibration = (a: { x: number; z: number }, b: { x: number; z: number }, known: number) => {
    if (readOnly) return
    const next = {
      ...calibrate(a, b, known),
      method: 'manual' as const,
      basisPixels: Math.hypot(b.x - a.x, b.z - a.z),
    }
    const copy = setLevelCalibration(project, level.id, next)
    setProject(copy)
    saveProject(copy)
    setShowImport(false)
    setManualScale(false)
    setMode('edit')
    setView('plan')
    if (!backend && source && url) analysis.analyze(url, next, source)
  }
  const analyzePlan = () => {
    if (backend) {
      analysis.clear()
      onBackendAnalysis?.()
      return
    }
    if (!source || !url) return
    setShowImport(false)
    setMode('edit')
    setView('plan')
    analysis.analyze(url, calibration || initialAutoScale(source.width, source.height), source, saveAutoScale)
    setSelectedDetection(null)
  }
  const applySpan = (metres: number) => {
    if (readOnly) return
    const next = setEstimatedSpan(calibration!, metres)
    const copy = setLevelCalibration(project, level.id, next)
    setProject(copy)
    void saveProject(copy)
    setShowImport(false)
    setView('plan')
    if (!backend && source && url) analysis.analyze(url, next, source)
  }
  const reuseGroundScale = () => {
    if (readOnly) return
    if (!source) return
    const next = reusedGroundCalibration(project, source)
    if (!next) return
    const copy = setLevelCalibration(project, level.id, next)
    setProject(copy)
    void saveProject(copy)
    setShowImport(false)
    if (!backend && url) analysis.analyze(url, next, source)
  }
  useEffect(() => {
    if (backend || readOnly || !source || !url || autoStarted.current === source.id) return
    if ((!calibration || calibration.method === 'auto') && !level.walls.length) {
      autoStarted.current = source.id
      void analysis.analyze(
        url,
        calibration || initialAutoScale(source.width, source.height),
        source,
        saveAutoScale,
      )
    }
  }, [source, url, calibration, level.walls.length, analysis, saveAutoScale, readOnly, backend])
  useEffect(() => {
    if (!buildRequested.current || analysis.status !== 'completed') return
    const frame = requestAnimationFrame(() => {
      buildRequested.current = false
      if (analysis.candidates.length) acceptCandidates(level.walls.length > 0)
    })
    return () => cancelAnimationFrame(frame)
  }, [analysis.status, analysis.candidates.length, acceptCandidates, level.walls.length])
  const requestBuild = () => {
    buildRequested.current = true
  }
  return { analyzePlan, applyCalibration, applySpan, requestBuild, reuseGroundScale }
}
