import { type Door, type Level, type Roof, type Selection } from '../domain/types'
import { verandaGeometry, verandaCover } from '../geometry/veranda'
import { SlabMesh } from './SlabMesh'
import { ArchitecturalDetailMesh } from './ArchitecturalDetailMesh'
import { RoofAssembly } from './RoofAssembly'
import { roofHeightAt } from '../geometry/roofClosure'
import { roofLayout } from '../geometry/roof'

export function VerandaMesh({ level, door, roof, roofShown = true, selection, select }: { level: Level; door: Door; roof?: Roof; roofShown?: boolean; selection: Selection; select: (value: Selection) => void }) {
  const geometry = verandaGeometry(level, door), veranda = door.veranda
  if (!geometry || !veranda) return null
  const choose = () => select({ kind: 'door', id: door.id })
  const cover = verandaCover(level, door, roof)
  return <group onClick={event => { event.stopPropagation(); choose() }}>
    <SlabMesh slab={geometry.slab} selection={selection?.id === door.id ? { kind: 'slab', id: geometry.slab.id } : null} select={choose} />
    {veranda.railing && geometry.rails.map(([start, end], i) => <ArchitecturalDetailMesh key={i} detail={{ id: `veranda-rail:${door.id}:${i}`,
      name: 'Veranda guardrail', kind: 'railing', start, end, baseElevation: 0, height: 1.1, depth: .06, spacing: .12,
      material: 'steel', color: '#515e65' }} selection={null} select={choose} />)}
    {cover && roofShown && <group position={[geometry.anchor.x, 0, geometry.anchor.z]} rotation={[0, -geometry.angle, 0]}>
      <RoofAssembly bounds={cover.bounds} roof={cover.roof} infill={false} />
    </group>}
    {cover && geometry.polygon.slice(2).map((p, i) => {
      const dx = p.x - geometry.anchor.x, dz = p.z - geometry.anchor.z
      const local = { x: dx * Math.cos(geometry.angle) + dz * Math.sin(geometry.angle), z: -dx * Math.sin(geometry.angle) + dz * Math.cos(geometry.angle) }
      const height = (roofHeightAt(roofLayout(cover.bounds, cover.roof).faces, local) || cover.bounds.top) - .08
      return <mesh key={i} position={[p.x, height / 2, p.z]} castShadow>
        <boxGeometry args={[.14, height, .14]} /><meshStandardMaterial color="#d7d6ce" roughness={.85} />
      </mesh>
    })}
  </group>
}
