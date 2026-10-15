import type { SeatingSection, Selection } from '../../domain/types'
import type { Tool } from '../../state/project'

export function SeatingLayer({ sections, selection, select, tool }: { sections: SeatingSection[]; selection: Selection;
  select: (selection: Selection) => void; tool: Tool }) {
  return <g className="seating-layer" pointerEvents={tool === 'select' ? 'auto' : 'none'}>
    {sections.map(section => {
      const dx = section.end.x - section.start.x, dz = section.end.z - section.start.z
      const length = Math.hypot(dx, dz) || 1, ox = section.outward.x / (Math.hypot(section.outward.x, section.outward.z) || 1),
        oz = section.outward.z / (Math.hypot(section.outward.x, section.outward.z) || 1)
      const spread=(section.rowWidthGrowth||0)*(section.rows-1)/2
      const end = { x: section.end.x + ox * section.rows * section.rowDepth+dx/length*spread, z: section.end.z + oz * section.rows * section.rowDepth+dz/length*spread }
      const start = { x: section.start.x + ox * section.rows * section.rowDepth-dx/length*spread, z: section.start.z + oz * section.rows * section.rowDepth-dz/length*spread }
      const selected = selection?.kind === 'seating' && selection.id === section.id
      return <g key={section.id} className="plan-entity" onPointerDown={event => { event.stopPropagation(); select({ kind: 'seating', id: section.id }) }}>
        <polygon points={[section.start, section.end, end, start].map(point => `${point.x},${point.z}`).join(' ')}
          fill={selected ? '#c6a875' : section.aisle ? '#c6bca5' : section.seatColor}
          fillOpacity={section.aisle ? '.8' : '.2'} stroke={selected ? '#a26e32' : '#566964'} strokeWidth=".08" />
        {Array.from({ length: section.rows }, (_, row) => {
          const offset = (row + .5) * section.rowDepth
          const growth=row*(section.rowWidthGrowth||0)/2
          const a = { x: section.start.x + ox * offset-dx/length*growth, z: section.start.z + oz * offset-dz/length*growth }
          const b = { x: section.end.x + ox * offset+dx/length*growth, z: section.end.z + oz * offset+dz/length*growth }
          return <line key={row} x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#61756d" strokeWidth={Math.max(.035, section.rowDepth * .045)} />
        })}
        {!section.aisle && length > 8 && <text x={(section.start.x + section.end.x) / 2 + ox * section.rows * section.rowDepth * .5}
          y={(section.start.z + section.end.z) / 2 + oz * section.rows * section.rowDepth * .5}
          textAnchor="middle" className="room-label">{section.name} · {section.seatsPerRow} seats/row</text>}
      </g>
    })}
  </g>
}
