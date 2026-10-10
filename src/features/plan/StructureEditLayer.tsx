import type { Level, Selection } from '../../domain/types'
import { stairOpening } from '../../geometry/stairs'
import { verandaGeometry } from '../../geometry/veranda'
import { useProject } from '../../state/project'

export function StructureEditLayer({ level, select }: { level: Level; select: (value: Selection) => void }) {
  const project = useProject(state => state.project), tool = useProject(state => state.tool)
  const points = (polygon: { x: number; z: number }[]) => polygon.map(p => `${p.x},${p.z}`).join(' ')
  return <g pointerEvents={tool === 'select' ? 'auto' : 'none'}>
    {level.slabs?.map(slab => <polygon key={slab.id} points={points(slab.polygon)} fill="none" stroke="#6c8e83" strokeWidth=".08" pointerEvents="stroke"
      onPointerDown={event => { event.stopPropagation(); select({ kind: 'slab', id: slab.id }) }} />)}
    {level.columns?.map(column => <rect key={column.id} x={column.position.x - (column.shape === 'circular' ? column.diameter : column.width) / 2} y={column.position.z - (column.shape === 'circular' ? column.diameter : column.depth) / 2}
      width={column.shape === 'circular' ? column.diameter : column.width} height={column.shape === 'circular' ? column.diameter : column.depth}
      rx={column.shape === 'circular' ? column.diameter / 2 : 0} transform={`rotate(${column.rotation || 0} ${column.position.x} ${column.position.z})`} fill="#687a7b" stroke="#354b51" strokeWidth=".035"
      onPointerDown={event => { event.stopPropagation(); select({ kind: 'column', id: column.id }) }} />)}
    {level.stairs?.map(stair => <polygon key={stair.id} points={points(stairOpening(stair, project?.buildings[0].levels || []))}
      fill="#a2b3b7" fillOpacity=".5" stroke="#47606a" strokeWidth=".06" onPointerDown={event => { event.stopPropagation(); select({ kind: 'stair', id: stair.id }) }} />)}
    {level.doors.filter(door => door.veranda).map(door => { const veranda = verandaGeometry(level, door)
      return veranda && <g key={door.id} onPointerDown={event => { event.stopPropagation(); select({ kind: 'door', id: door.id }) }}>
        <polygon points={points(veranda.polygon)} fill="#c9c6b2" fillOpacity=".7" stroke="#657d73" strokeWidth=".04" />
        <text x={veranda.polygon[2].x} y={veranda.polygon[2].z} fontSize=".16">Veranda</text>
      </g> })}
  </g>
}
