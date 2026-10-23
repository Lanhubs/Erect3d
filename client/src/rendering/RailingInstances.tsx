import { useMemo } from 'react'
import type { ArchitecturalDetail, Selection } from '../domain/types'
import { EntityInstances, spatialBatches, type InstancePart } from './EntityInstances'
export function RailingInstances({
  details,
  select,
}: {
  details: ArchitecturalDetail[]
  select: (selection: Selection) => void
}) {
  const parts = useMemo(() => {
    const metal: InstancePart[] = [],
      glass: InstancePart[] = []
    for (const detail of details) {
      const dx = detail.end.x - detail.start.x,
        dz = detail.end.z - detail.start.z,
        length = Math.hypot(dx, dz),
        rotation = -Math.atan2(dz, dx),
        selection = { kind: 'detail' as const, id: detail.id }
      if (length < 0.1) continue
      const x = (detail.start.x + detail.end.x) / 2,
        z = (detail.start.z + detail.end.z) / 2,
        height = detail.height,
        base = detail.baseElevation
      glass.push({
        center: [x, base + height * 0.52, z],
        size: [Math.max(0.05, length - 0.08), height * 0.8, 0.025],
        rotation,
        selection,
      })
      metal.push({ center: [x, base + height, z], size: [length, 0.055, 0.06], rotation, selection })
      const posts = Math.max(1, Math.ceil(length / Math.max(0.5, detail.spacing)))
      for (let i = 0; i <= posts; i++)
        metal.push({
          center: [detail.start.x + (dx * i) / posts, base + height / 2, detail.start.z + (dz * i) / posts],
          size: [0.06, height, 0.06],
          rotation,
          selection,
        })
    }
    return { metal, glass }
  }, [details])
  return (
    <group name="editable-concourse-railing-batches">
      {[...spatialBatches(parts.metal)].map(([zone, rows]) => (
        <EntityInstances key={`rail:${zone}`} parts={rows} color="#6b767b" material="metal" select={select} />
      ))}
      {[...spatialBatches(parts.glass)].map(([zone, rows]) => (
        <EntityInstances
          key={`glass:${zone}`}
          parts={rows}
          color="#b7d1d7"
          material="glass"
          shadow={false}
          select={select}
        />
      ))}
    </group>
  )
}
