import { useMemo } from 'react'
import type { Column, Selection } from '../domain/types'
import { EntityInstances, spatialBatches, type InstancePart } from './EntityInstances'
export function ColumnInstances({
  columns,
  selection,
  select,
}: {
  columns: Column[]
  selection: Selection
  select: (selection: Selection) => void
}) {
  const batches = useMemo(() => {
    const groups = new Map<string, InstancePart[]>()
    for (const column of columns) {
      if (selection?.id === column.id) continue
      const key = `${column.material}:${column.shape}`,
        parts = groups.get(key) || []
      parts.push({
        center: [column.position.x, column.height / 2, column.position.z],
        size:
          column.shape === 'circular'
            ? [column.diameter, column.height, column.diameter]
            : [column.width, column.height, column.depth],
        rotation: (-(column.rotation || 0) * Math.PI) / 180,
        selection: { kind: 'column', id: column.id },
      })
      groups.set(key, parts)
    }
    return [...groups].flatMap(([key, parts]) =>
      [...spatialBatches(parts)].map(([zone, rows]) => ({
        key: `${key}:${zone}`,
        rows,
        shape: key.endsWith('circular') ? ('column' as const) : ('box' as const),
        material: key.split(':')[0],
      })),
    )
  }, [columns, selection?.id])
  return (
    <group name="editable-column-batches">
      {batches.map((batch) => (
        <EntityInstances
          key={batch.key}
          parts={batch.rows}
          shape={batch.shape}
          color={batch.material === 'steel' ? '#737d82' : batch.material === 'timber' ? '#947557' : '#c1bdb4'}
          material={batch.material === 'steel' ? 'metal' : 'solid'}
          select={select}
        />
      ))}
    </group>
  )
}
