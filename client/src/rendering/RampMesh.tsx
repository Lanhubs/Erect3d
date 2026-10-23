import type { Ramp, Selection } from '../domain/types'

export function RampMesh({
  ramp,
  selection,
  select,
}: {
  ramp: Ramp
  selection: Selection
  select: (selection: Selection) => void
}) {
  const dx = ramp.end.x - ramp.start.x,
    dz = ramp.end.z - ramp.start.z
  const length = Math.hypot(dx, dz)
  if (length < 0.05) return null
  const rise = ramp.endElevation - ramp.startElevation
  const angle = Math.atan2(rise, length)
  const heading = Math.atan2(dz, dx)
  const selected = selection?.kind === 'ramp' && selection.id === ramp.id
  const color =
    ramp.material === 'timber' ? '#94785b' : ramp.material === 'steel-deck' ? '#79868a' : '#999b96'
  return (
    <group
      position={[ramp.start.x, 0, ramp.start.z]}
      rotation={[0, -heading, 0]}
      onClick={(event) => {
        event.stopPropagation()
        select({ kind: 'ramp', id: ramp.id })
      }}
    >
      <mesh
        position={[length / 2, (ramp.startElevation + ramp.endElevation) / 2, 0]}
        rotation={[0, 0, angle]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[length, ramp.thickness, ramp.width]} />
        <meshStandardMaterial
          color={selected ? '#c3a36e' : color}
          roughness={0.84}
          metalness={ramp.material === 'steel-deck' ? 0.22 : 0.02}
        />
      </mesh>
      <mesh
        position={[length / 2, (ramp.startElevation + ramp.endElevation) / 2 + 0.012, 0]}
        rotation={[0, 0, angle]}
      >
        <boxGeometry args={[length - 0.04, 0.018, Math.max(0.05, ramp.width - 0.08)]} />
        <meshStandardMaterial color={selected ? '#dec391' : '#b5b3aa'} roughness={0.8} />
      </mesh>
    </group>
  )
}
