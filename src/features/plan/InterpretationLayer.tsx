import type { Point } from '../../domain/types'
import type { PlanDetail } from '../../domain/interpretationTypes'
import { spaceKey } from '../../geometry/spaceReview'

export function InterpretationLayer({ spaces = [], spaceChoices = {}, selectedSpace, selectSpace, details = [], choices = {} }: {
  spaces?: Point[][]; spaceChoices?: Record<string, boolean>; selectedSpace?: string | null; selectSpace?: (key: string) => void; details?: PlanDetail[]; choices?: Record<string, boolean>
}) {
  return <g pointerEvents="none">
    {spaces.map((polygon, index) => {
      const key = spaceKey(polygon), included = spaceChoices[key] !== false, selected = selectedSpace === key
      return <polygon key={key} data-space-key={key} data-included={included} data-selected={selected}
        points={polygon.map(point => `${point.x},${point.z}`).join(' ')} pointerEvents={selectSpace ? 'visiblePainted' : 'none'}
        onPointerDown={event => { if (selectSpace) { event.stopPropagation(); selectSpace(key) } }}
        fill={included ? '#4b91b1' : '#bd7640'} fillOpacity={selected ? '.3' : included ? '.1' : '.04'}
        stroke={selected ? '#205f82' : included ? '#49809a' : '#a77852'} strokeOpacity=".8" strokeWidth={selected ? '.09' : '.025'}
        strokeDasharray={included ? undefined : '.12 .09'}><title>Space {index + 1} · {included ? 'floor and roof included' : 'floor and roof excluded'}</title></polygon>
    })}
    {details.map((detail, index) => <g key={detail.id} opacity={choices[detail.id] === false ? .3 : 1}>
      <polygon points={detail.polygon.map(point => `${point.x},${point.z}`).join(' ')} fill={detail.kind === 'stair' ? '#79719d' : '#418873'}
        fillOpacity=".16" stroke={detail.kind === 'stair' ? '#6c588b' : '#367762'} strokeWidth=".05" strokeDasharray=".12 .06" />
      <title>{detail.kind === 'stair' ? 'Stair footprint' : 'Column'} {index + 1}: {detail.evidence}</title>
    </g>)}
  </g>
}
