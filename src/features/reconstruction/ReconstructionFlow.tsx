import type { SourceDocument } from '../../domain/types'
import type { AnalysisStatus } from '../import/useAnalysis'

type Props = {
  source?: SourceDocument; calibrated: boolean; calibrationOpen: boolean; ready: boolean; walls: number
  candidates: number; unresolved: number; status: AnalysisStatus
  calibrate: () => void; analyze: () => void; generate: () => void; manual: () => void
  build: (replace: boolean) => void; discard: () => void; view3D: () => void
}

export function ReconstructionFlow({ source, calibrated, calibrationOpen, ready, walls, candidates, unresolved, status,
  calibrate, analyze, generate, manual, build, discard, view3D }: Props) {
  if (!source) return <section className="reconstruction-flow">
    <div><strong>FROM PLAN TO 3D</strong><span>Import a floor plan, then calibrate its scale.</span></div>
  </section>
  if (!calibrated) return <section className="reconstruction-flow">
    <div><strong>PLAN SETUP · SET SCALE</strong><span>Select two points along a known dimension before analysis.</span></div>
    {!calibrationOpen && <button className="primary" onClick={calibrate}>Set scale</button>}
    {walls > 0 && <button onClick={view3D}>View existing model</button>}
  </section>
  if (status === 'preparing' || status === 'analyzing' || status === 'building') return <section className="reconstruction-flow">
    <div><strong>ANALYZING PLAN</strong><span>{status === 'preparing' ? 'Preparing the image…' : status === 'building' ? 'Cleaning geometry…' : 'Detecting structure…'}</span></div>
  </section>
  if (status === 'completed' && candidates > 0) return <section className="reconstruction-flow">
    <div><strong>REVIEW DETECTIONS</strong><span>{candidates} wall candidates. Inspect the source overlay and remove false lines before accepting.</span></div>
    <button className="primary" disabled={unresolved > 0} title={unresolved ? 'Classify the openings that need review first.' : undefined}
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
  if (status === 'completed') return <section className="reconstruction-flow">
    <div><strong>NO WALLS FOUND</strong><span>This image has no detectable wall shapes. Draw the main walls on the plan.</span></div>
    <button className="primary" onClick={manual}>Draw walls</button>
  </section>
  return <section className="reconstruction-flow">
    <div><strong>PLAN SETUP COMPLETE</strong><span>Analyze the source, review detections, then generate the building.</span></div>
    <button className="primary" disabled={!ready} onClick={generate}>Analyze plan</button>
    <button onClick={manual}>Trace manually</button>
  </section>
}
