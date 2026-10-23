import { SharedStandardMaterial } from './SharedStandardMaterial'
import { Quaternion, Vector3 } from 'three'
import type { Stair } from '../domain/types'
import type { Step } from '../geometry/stairs'

type Position = [number, number, number]
function Beam({
  a,
  b,
  thickness,
  depth,
  color,
}: {
  a: Position
  b: Position
  thickness: number
  depth: number
  color: string
}) {
  const start = new Vector3(...a),
    end = new Vector3(...b)
  const direction = end.clone().sub(start),
    length = direction.length()
  if (length < 0.01) return null
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), direction.normalize())
  const center = start.add(end).multiplyScalar(0.5)
  return (
    <mesh position={center.toArray()} quaternion={rotation} castShadow receiveShadow>
      <boxGeometry args={[length, thickness, depth]} />
      <SharedStandardMaterial color={color} metalness={0.48} roughness={0.48} />
    </mesh>
  )
}

function Post({ base, top, color }: { base: Position; top: Position; color: string }) {
  return <Beam a={base} b={top} thickness={0.045} depth={0.045} color={color} />
}

export function StairFrame({ stair, steps, selected }: { stair: Stair; steps: Step[]; selected: boolean }) {
  if (!steps.length) return null
  const split = stair.form === 'straight' ? steps.length : Math.ceil(steps.length / 2)
  const run1 = split * stair.treadDepth,
    run2 = (steps.length - split) * stair.treadDepth
  const middle = steps[split - 1].height,
    rise = steps.at(-1)!.height
  const rail = selected ? '#9a744b' : '#4f5c5a'
  const support = selected ? '#a3825c' : '#727b79'
  const first = (side: number) => {
    const v = (side * stair.width) / 2
    const start: Position = [0, 0.04, v],
      end: Position = [run1, middle - 0.12, v]
    const railStart: Position = [0, 0.95, v],
      railEnd: Position = [run1, middle + 0.88, v]
    return (
      <group key={`first-${side}`}>
        <Beam a={start} b={end} thickness={0.17} depth={0.1} color={support} />
        <Beam a={railStart} b={railEnd} thickness={0.055} depth={0.055} color={rail} />
        <Post base={[0, 0.04, v]} top={railStart} color={rail} />
        <Post base={[run1, middle - 0.12, v]} top={railEnd} color={rail} />
      </group>
    )
  }
  const second = (side: number) => {
    if (stair.form === 'straight') return null
    const start: Position =
      stair.form === 'L'
        ? [run1 + stair.width / 2 + (side * stair.width) / 2, middle - 0.12, stair.width / 2]
        : [
            run1 + stair.landingLength,
            middle - 0.12,
            stair.width + stair.landingLength + (side * stair.width) / 2,
          ]
    const end: Position =
      stair.form === 'L'
        ? [start[0], rise - 0.12, stair.width / 2 + run2]
        : [run1 + stair.landingLength - run2, rise - 0.12, start[2]]
    const railStart: Position = [start[0], middle + 0.88, start[2]]
    const railEnd: Position = [end[0], rise + 0.88, end[2]]
    return (
      <group key={`second-${side}`}>
        <Beam a={start} b={end} thickness={0.17} depth={0.1} color={support} />
        <Beam a={railStart} b={railEnd} thickness={0.055} depth={0.055} color={rail} />
        <Post base={start} top={railStart} color={rail} />
        <Post base={end} top={railEnd} color={rail} />
        {stair.form === 'U' && (
          <>
            <Beam a={railEnd} b={[-0.12, rise + 0.88, end[2]]} thickness={0.055} depth={0.055} color={rail} />
            <Post base={[-0.12, rise - 0.12, end[2]]} top={[-0.12, rise + 0.88, end[2]]} color={rail} />
          </>
        )}
      </group>
    )
  }
  return (
    <group>
      {[-1, 1].map(first)}
      {[-1, 1].map(second)}
    </group>
  )
}
