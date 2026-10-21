import {SharedStandardMaterial} from './SharedStandardMaterial'
import { useMemo } from 'react'
import type { Level, Selection, Stair } from '../domain/types'
import { stairLanding, stairSteps, stairExitLanding } from '../geometry/stairs'
import { pointerCursor } from './pointerCursor'
import { StairFrame } from './StairFrame'

function finishColor(levels: Level[], stair: Stair) {
  const finish = levels.find(level => level.id === stair.fromLevelId)?.slabs?.[0]?.finishMaterial
  if (finish === 'timber' || finish === 'laminate') return '#aa8662'
  if (finish === 'marble' || finish === 'porcelain-tile' || finish === 'tile') return '#dad7cc'
  return '#b9b8b0'
}

export function StairMesh({ stair, levels, selection, select }: { stair: Stair; levels: Level[]; selection: Selection;
  select: (selection: Selection) => void }) {
  const steps = useMemo(() => stairSteps(stair, levels), [stair, levels])
  const landing = useMemo(() => stairLanding(stair, levels), [stair, levels])
  const exit = useMemo(() => stairExitLanding(stair, levels), [stair, levels])
  const selected = selection?.id === stair.id
  const tread = selected ? '#d6ae73' : finishColor(levels, stair)
  const riser = selected ? '#b88f5d' : '#878c88'
  return <group position={[stair.start.x, 0, stair.start.z]} rotation={[0, -stair.direction * Math.PI / 180, 0]}
    onPointerOver={() => pointerCursor(true)} onPointerOut={() => pointerCursor(false)}
    onClick={event => { event.stopPropagation(); select({ kind: 'stair', id: stair.id }) }}>
    {steps.map((step, index) => {
      const previous = index ? steps[index - 1].height : 0
      const riserHeight = step.height - previous
      return <group key={index} position={[step.u, 0, step.v]} rotation={[0, -step.turn, 0]}>
        <mesh position={[0, step.height - .045, 0]} castShadow receiveShadow>
          <boxGeometry args={[step.depth, .09, step.width]} />
          <SharedStandardMaterial color={tread} roughness={.8} />
        </mesh>
        <mesh position={[-step.depth / 2 + .018, previous + riserHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[.036, riserHeight, step.width]} />
          <SharedStandardMaterial color={riser} metalness={.12} roughness={.8} />
        </mesh>
      </group>
    })}
    {[landing, exit].filter(item => item !== null).map((item, i) => <mesh key={`landing:${i}`} position={[item.u, item.height - .09, item.v]} castShadow receiveShadow>
      <boxGeometry args={[item.sizeU, .18, item.sizeV]} />
      <SharedStandardMaterial color={tread} roughness={.8} />
    </mesh>)}
    <StairFrame stair={stair} steps={steps} selected={selected} />
  </group>
}
