import type { Point } from '../../domain/types'
import { distance, wallCurveThroughPoints, wallSubpath } from '../../geometry/math'
import { formatDistance, type Unit } from '../../geometry/units'

export function PlanDraftLayer({ tool, draft, curveDraft, rampDraft, cursor, snapGuide, measure, unit }: {
  tool: string; draft: Point[]; curveDraft: Point[]; rampDraft: Point[]; cursor: Point | null;
  snapGuide: Point | null; measure: Point[]; unit: Unit
}) {
  const curve = cursor && curveDraft.length === 2 ? wallCurveThroughPoints(curveDraft[0], curveDraft[1], cursor) : null
  const preview = curve && cursor ? wallSubpath({ id: 'preview', start: curveDraft[0], end: cursor, curve,
    thickness: .1, height: 2.8, material: 'plaster' }, 0, undefined, .2) : []
  return <>
    {draft.length > 0 && cursor && <polyline points={[...draft, cursor].map(point => `${point.x},${point.z}`).join(' ')}
      fill="none" stroke="#b28b4a" strokeWidth=".045" strokeDasharray=".14 .09" />}
    {tool === 'curve' && cursor && curveDraft.length === 1 && <line x1={curveDraft[0].x} y1={curveDraft[0].z}
      x2={cursor.x} y2={cursor.z} stroke="#b28b4a" strokeWidth=".035" strokeDasharray=".12 .08" />}
    {tool === 'curve' && preview.length > 0 && <polyline points={preview.map(point => `${point.x},${point.z}`).join(' ')}
      fill="none" stroke="#b28b4a" strokeWidth=".045" strokeDasharray=".14 .09" />}
    {tool === 'ramp' && rampDraft.length > 0 && cursor && <line x1={rampDraft[0].x} y1={rampDraft[0].z}
      x2={cursor.x} y2={cursor.z} stroke="#a96f30" strokeWidth="1.2" strokeOpacity=".5" strokeDasharray=".2 .12" />}
    {snapGuide && <circle cx={snapGuide.x} cy={snapGuide.z} r=".09" fill="none" stroke="#b28b4a" strokeWidth=".035" pointerEvents="none" />}
    {measure.length === 2 && <g>
      <line x1={measure[0].x} y1={measure[0].z} x2={measure[1].x} y2={measure[1].z} stroke="#ad7145" strokeWidth=".035" />
      <text x={(measure[0].x + measure[1].x) / 2} y={(measure[0].z + measure[1].z) / 2 - .12}
        textAnchor="middle" className="measure-label">{formatDistance(distance(measure[0], measure[1]), unit)}</text>
    </g>}
  </>
}
