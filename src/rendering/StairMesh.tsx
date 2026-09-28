import { useMemo } from 'react'
import type { Level, Selection, Stair } from '../domain/types'
import { stairLanding, stairSteps } from '../geometry/stairs'
import { pointerCursor } from './pointerCursor'

export function StairMesh({ stair, levels, selection, select }: { stair: Stair; levels: Level[]; selection: Selection;
  select: (selection: Selection) => void }) {
  const steps = useMemo(() => stairSteps(stair, levels), [stair, levels])
  const landing = useMemo(() => stairLanding(stair, levels), [stair, levels])
  return <group position={[stair.start.x, 0, stair.start.z]} rotation={[0, -stair.direction * Math.PI / 180, 0]}
    onPointerOver={() => pointerCursor(true)} onPointerOut={() => pointerCursor(false)}
    onClick={event => { event.stopPropagation(); select({ kind: 'stair', id: stair.id }) }}>
    {steps.map((step, index) => <mesh key={index} position={[step.u, step.height / 2, step.v]} rotation={[0, -step.turn, 0]} castShadow receiveShadow>
      <boxGeometry args={[step.depth, step.height, step.width]} />
      <meshStandardMaterial color={selection?.id === stair.id ? '#c19b67' : '#c0b9ab'} roughness={.82} />
    </mesh>)}
    {landing && <mesh position={[landing.u, landing.height - .08, landing.v]} castShadow receiveShadow>
      <boxGeometry args={[landing.sizeU, .16, landing.sizeV]} />
      <meshStandardMaterial color={selection?.id === stair.id ? '#c19b67' : '#c0b9ab'} roughness={.82} />
    </mesh>}
  </group>
}
