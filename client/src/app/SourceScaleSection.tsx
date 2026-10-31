import type { Dispatch, SetStateAction } from 'react'
import { CalibrationPanel } from '../features/import/CalibrationPanel'
import { SourceNotice } from './SourceNotice'
import { SourceScalePreview } from './SourceScalePreview'
import type { usePlanSource } from '../features/import/usePlanSource'
import { useProject } from '../state/project'
import type { Calibration, Level, Project } from '../domain/types'
import type { WorkspaceMode } from './WorkspaceHeader'

export function SourceScaleSection({
  analysisError,
  applyCalibration,
  applySpan,
  calibration,
  level,
  manualScale,
  page,
  planSource,
  project,
  reuseGroundScale,
  setManualScale,
  setMode,
  setPage,
  setShowImport,
  showImport,
}: {
  analysisError: string
  applyCalibration: (a: { x: number; z: number }, b: { x: number; z: number }, known: number) => void
  applySpan: (metres: number) => void
  calibration?: Calibration
  level: Level
  manualScale: boolean
  page: number
  planSource: ReturnType<typeof usePlanSource>
  project: Project
  reuseGroundScale: () => void
  setManualScale: Dispatch<SetStateAction<boolean>>
  setMode: Dispatch<SetStateAction<WorkspaceMode>>
  setPage: Dispatch<SetStateAction<number>>
  setShowImport: Dispatch<SetStateAction<boolean>>
  showImport: boolean
}) {
  const setView = useProject((s) => s.setView),
    { busy, error, pages, selectPage, source, stage, url } = planSource
  return (
    <>
      <SourceNotice
        source={source}
        error={error}
        analysisError={analysisError}
        busy={busy}
        stage={stage}
        pages={pages}
        page={page}
        setPage={setPage}
        selectPage={selectPage}
        onLoaded={() => {
          setShowImport(false)
          setManualScale(false)
          setMode('edit')
          setView('plan')
        }}
      />
      {showImport &&
        source &&
        url &&
        (manualScale ? (
          <CalibrationPanel
            key={source.id}
            url={url}
            width={source.width}
            height={source.height}
            unit={project.units}
            onSave={(a, b, metres) => {
              applyCalibration(a, b, metres)
              setShowImport(false)
            }}
          />
        ) : calibration ? (
          <SourceScalePreview
            source={source}
            url={url}
            calibration={calibration}
            groundScale={
              level.id === project.buildings[0].levels[0].id
                ? undefined
                : project.buildings[0].levels[0].calibration || project.calibration
            }
            onApply={applySpan}
            onPoints={() => setManualScale(true)}
            onClose={() => setShowImport(false)}
            onReuse={reuseGroundScale}
          />
        ) : null)}
    </>
  )
}
