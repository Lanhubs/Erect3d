import type { Slab } from '../../domain/types'

const path = (polygon: Slab['polygon']) => polygon.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.z}`).join(' ') + ' Z'
export function SlabLayer({ slabs }: { slabs: Slab[] }) {
  return <g className="slab-plan-layer" pointerEvents="none">
    {slabs.map(slab => <g key={slab.id}>
      <path d={[path(slab.polygon), ...slab.openings.map(opening => path(opening.polygon))].join(' ')}
        fillRule="evenodd" fill="#97a49a" fillOpacity=".12" stroke="#879488" strokeWidth=".035" />
      {slab.openings.map(opening => <path key={opening.id} d={path(opening.polygon)} fill="none"
        stroke={opening.kind === 'stair' ? '#9c7547' : '#778b7e'} strokeWidth=".04" strokeDasharray=".15 .09" />)}
    </g>)}
  </g>
}
