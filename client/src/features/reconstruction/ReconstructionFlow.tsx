import type { SourceDocument } from '../../domain/types'
import type { AnalysisStatus } from '../import/useAnalysis'

type Props = {
  source?: SourceDocument; calibrated: boolean; calibrationOpen: boolean; ready: boolean; walls: number
  candidates: number; unresolved: number; status: AnalysisStatus
  analyze: () => void; generate: () => void; manual: () => void
  build: (replace: boolean) => void; discard: () => void; view3D: () => void
}

export function ReconstructionFlow({ source, calibrated, calibrationOpen, ready, walls, candidates, unresolved, status,
  analyze, generate, manual, build, discard, view3D }: Props) {
  if (!source) return <section className="reconstruction-flow">
    <div><strong>FROM PLAN TO 3D</strong><span>Import a floor plan. Scale and wall analysis start automatically.</span></div>
  </section>
  if (!calibrated) return <section className="reconstruction-flow">
    <div><strong>READY TO ANALYZE</strong><span>Scale will be estimated from the drawing. No point selection is required.</span></div>
    {!calibrationOpen && <button className="primary" onClick={analyze}>Analyze plan</button>}
    {walls > 0 && <button onClick={view3D}>View existing model</button>}
  </section>
  if (status === 'preparing' || status === 'analyzing' || status === 'building') return <section className="reconstruction-flow">
    <div><strong>ANALYZING PLAN</strong><span>{status === 'preparing' ? 'Preparing the image…' : status === 'building' ? 'Cleaning geometry…' : 'Detecting structure…'}</span></div>
  </section>
  if (status === 'completed' && candidates > 0) return <section className="reconstruction-flow">
    <div><strong>3D READY TO BUILD</strong><span>{candidates} walls found. {unresolved ? `${unresolved} uncertain gaps will stay closed unless you classify them.` : 'Review or generate the building now.'}</span></div>
    <button className="primary"
      onClick={() => build(walls > 0)}>{walls > 0 ? 'Replace model & view 3D' : 'Accept & generate 3D'}</button>
    {walls > 0 && <button onClick={() => build(false)}>Add to existing model</button>}
    <button onClick={discard}>Reset analysis</button>
  </section>
  if (walls > 0) return <section className="reconstruction-flow ready-flow">
    <div><strong>3D MODEL READY</strong><span>{walls} walls. Review geometry against the source and edit any missing openings.</span></div>
    <button className="primary" onClick={view3D}>View 3D model</button>
    <button onClick={manual}>Edit walls</button>
    <button disabled={!ready} onClick={analyze}>Reanalyze plan</button>
  </section>
  if (status === 'completed') return null
  return <section className="reconstruction-flow">
    <div><strong>PLAN READY</strong><span>Automatic scale is available. Analyze the source to build its walls in 3D.</span></div>
    <button className="primary" disabled={!ready} onClick={generate}>Analyze plan</button>
    <button onClick={manual}>Trace manually</button>
  </section>
}
