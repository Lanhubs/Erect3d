import type { Dispatch, SetStateAction } from 'react'
import { BackendEntry } from '../cloud/BackendEntry'
import { ReconstructionFlow } from '../features/reconstruction/ReconstructionFlow'
import { SourceStrip } from './SourceStrip'
import type { Calibration, Level, Project } from '../domain/types'
import type { useAnalysis } from '../features/import/useAnalysis'
import type { usePlanSource } from '../features/import/usePlanSource'
import { useProject, type View } from '../state/project'
import type { WorkspaceMode } from './WorkspaceHeader'

export function SourceWorkflowSection({
  analyzePlan,
  acceptCandidates,
  analysis,
  backend,
  calibration,
  chooseView,
  level,
  onBackendAnalysis,
  planSource,
  project,
  reconstructing,
  setLocalAnalysisMode,
  setManualScale,
  setMode,
  setPage,
  setShowImport,
  showImport,
}: {
  analyzePlan: () => void
  acceptCandidates: (replace: boolean) => void
  analysis: ReturnType<typeof useAnalysis>
  backend: boolean
  calibration?: Calibration
  chooseView: (view: View) => void
  level: Level
  onBackendAnalysis?: () => void
  planSource: ReturnType<typeof usePlanSource>
  project: Project
  reconstructing: boolean
  setLocalAnalysisMode: Dispatch<SetStateAction<boolean>>
  setManualScale: Dispatch<SetStateAction<boolean>>
  setMode: Dispatch<SetStateAction<WorkspaceMode>>
  setPage: Dispatch<SetStateAction<number>>
  setShowImport: Dispatch<SetStateAction<boolean>>
  showImport: boolean
}) {
  const readOnly = useProject((s) => s.readOnly),
    setTool = useProject((s) => s.setTool),
    setView = useProject((s) => s.setView),
    { busy, importFile, source, url } = planSource
  return (
    <fieldset disabled={readOnly} className="readonly-controls">
      <SourceStrip
        source={source}
        showImport={showImport}
        toggle={() => setShowImport((value) => !value)}
        importFile={async (chosen) => {
          if (await importFile(chosen)) {
            setPage(1)
            setShowImport(false)
            setManualScale(false)
            setMode('edit')
            setView('plan')
          }
        }}
      />
      {backend && !onBackendAnalysis && source ? (
        <BackendEntry project={project} local={() => setLocalAnalysisMode(true)} />
      ) : onBackendAnalysis && source ? (
        <section className="reconstruction-flow">
          <div>
            <strong>PLAN TO 3D</strong>
            <span>
              {level.walls.length
                ? `${level.walls.length} editable walls. Reconstructing replaces this floor and supports Undo.`
                : 'Reconstruct this drawing into an editable 3D model. Original image quality is preserved.'}
            </span>
          </div>
          <button className="primary" disabled={reconstructing || readOnly} onClick={onBackendAnalysis}>
            {reconstructing ? 'Reconstructing…' : 'Reconstruct in 3D'}
          </button>
          {level.walls.length > 0 && <button onClick={() => chooseView('model')}>View 3D model</button>}
        </section>
      ) : (
        <ReconstructionFlow
          source={source}
          calibrated={Boolean(calibration)}
          calibrationOpen={showImport}
          ready={Boolean(url && !busy)}
          walls={level.walls.length}
          candidates={analysis.candidates.length}
          unresolved={analysis.openings.filter((item) => item.choice === 'unknown').length}
          status={analysis.status}
          analyze={analyzePlan}
          generate={analyzePlan}
          manual={() => {
            setShowImport(false)
            setView('plan')
            setTool('wall')
          }}
          build={acceptCandidates}
          discard={analysis.clear}
          view3D={() => chooseView('model')}
        />
      )}
    </fieldset>
  )
}
