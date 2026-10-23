import { memo, useMemo } from 'react'
import type { Wall, WindowUnit, Selection } from '../domain/types'
import { windowAssembly } from '../geometry/windowAssembly'
import { EntityInstances } from './EntityInstances'
export const WindowMesh = memo(function WindowMesh({
  wall,
  window,
  selection,
  select,
}: {
  wall: Wall
  window: WindowUnit
  selection: Selection
  select: (s: Selection) => void
}) {
  const parts = useMemo(
    () => windowAssembly(wall, window),
    [
      wall,
      window.id,
      window.offset,
      window.width,
      window.height,
      window.sill,
      window.type,
      window.frameWidth,
      window.frameDepth,
      window.frameOffset,
      window.mullions,
      window.transoms,
      window.sillProjection,
    ],
  )
  const color =
    selection?.kind === 'window' && selection.id === window.id
      ? '#c58a39'
      : window.frame === 'timber'
        ? '#80694f'
        : '#697478'
  return (
    <group name={`window-assembly:${window.id}`}>
      <EntityInstances
        parts={parts.frame}
        color={color}
        material={window.frame === 'timber' ? 'timber' : 'metal'}
        select={select}
      />
      <EntityInstances
        parts={parts.glass}
        color="#c6dde1"
        material={window.glazing === 'frosted' ? 'frosted-glass' : 'window-glass'}
        shadow={false}
        select={select}
      />
      {!!parts.sill.length && (
        <EntityInstances parts={parts.sill} color="#c1beb4" material="stone" select={select} />
      )}
      {!!parts.hardware.length && (
        <EntityInstances parts={parts.hardware} color="#777f7f" material="metal" select={select} />
      )}
    </group>
  )
})
