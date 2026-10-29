import { useMemo } from 'react'
import type { Level, Selection } from '../domain/types'
import { DoorMesh } from './DoorMesh'
import { WallMesh } from './WallMesh'
import { RoomSurface } from './RoomSurface'
import { SlabMesh } from './SlabMesh'
import { ColumnMesh } from './ColumnMesh'
import { StairMesh } from './StairMesh'
import { RampMesh } from './RampMesh'
import { SeatingMesh } from './SeatingMesh'
import { ArchitecturalDetailMesh } from './ArchitecturalDetailMesh'
import { ceilingPlan } from '../geometry/ceilings'
import { CeilingSurface } from './CeilingSurface'
import { VerandaMesh } from './VerandaMesh'
import { FurnitureMeshes } from '../furniture/FurnitureMeshes'
import { ArchitectureFacade, batchedFacadeIds } from './ArchitectureFacade'
import { ColumnInstances } from './ColumnInstances'
import { useGraphicsSettings } from './GraphicsRuntime'
import { RailingInstances } from './RailingInstances'
import { createOpeningIndex } from '../geometry/hostedOpenings'
export function LevelGeometry({
  level,
  levels,
  generatedIds,
  curtainIds,
  selection,
  select,
  ceiling,
  roofShown,
  walk,
  openDoors,
}: {
  selection: Selection
  select: (s: Selection) => void
  ceiling: boolean
  roofShown: boolean
  walk: boolean
  openDoors: ReadonlySet<string>
} & { level: Level; levels: Level[]; generatedIds: ReadonlySet<string>; curtainIds: ReadonlySet<string> }) {
  const { optimized } = useGraphicsSettings()
  const openingIndex = useMemo(() => createOpeningIndex(), []),
    hosted = openingIndex(level)
  const facadeIds = useMemo(
    () => (optimized ? batchedFacadeIds(level, generatedIds, selection) : new Set<string>()),
    [level, generatedIds, selection, optimized],
  )
  const rails = useMemo(
    () =>
      optimized
        ? (level.details || []).filter(
            (detail) =>
              generatedIds.has(detail.id) &&
              detail.kind === 'railing' &&
              detail.material === 'glass' &&
              selection?.id !== detail.id,
          )
        : [],
    [optimized, level.details, generatedIds, selection?.id],
  )
  const railIds = useMemo(() => new Set(rails.map((detail) => detail.id)), [rails])
  const floorOpenings = useMemo(
    () => level.slabs?.flatMap((slab) => slab.openings.map((opening) => opening.polygon)) || [],
    [level.slabs],
  )
  const ceilings = useMemo(
    () => (ceiling || walk || roofShown ? ceilingPlan(level, levels) : []),
    [ceiling, walk, roofShown, level, levels],
  )
  return (
    <>
      {level.slabs?.map((slab) => (
        <SlabMesh key={slab.id} slab={slab} selection={selection} select={select} />
      ))}
      {level.rooms.map((room) => (
        <RoomSurface key={room.id} room={room} openings={floorOpenings} select={select} />
      ))}
      {!!facadeIds.size && (
        <ArchitectureFacade level={level} ids={facadeIds} color="#b7b6af" select={select} />
      )}
      {level.walls
        .filter((wall) => !facadeIds.has(wall.id) && !curtainIds.has(wall.id))
        .map((wall) => (
          <WallMesh
            key={wall.id}
            wall={wall}
            {...hosted.get(wall.id)!}
            selection={selection}
            select={select}
            openDoors={openDoors}
          />
        ))}
      {level.doors
        .filter((door) => curtainIds.has(door.wallId))
        .map((door) => (
          <DoorMesh
            key={door.id}
            door={door}
            wall={level.walls.find((w) => w.id === door.wallId)!}
            selection={selection}
            select={select}
            open={openDoors.has(door.id)}
          />
        ))}
      {level.doors
        .filter((door) => door.veranda)
        .map((door) => (
          <VerandaMesh
            key={`veranda:${door.id}`}
            level={level}
            door={door}
            roof={level.roof}
            roofShown={roofShown}
            selection={selection}
            select={select}
          />
        ))}
      {optimized && <ColumnInstances columns={level.columns || []} selection={selection} select={select} />}
      {level.columns
        ?.filter((column) => !optimized || selection?.id === column.id)
        .map((column) => (
          <ColumnMesh key={column.id} column={column} selection={selection} select={select} />
        ))}
      <FurnitureMeshes level={level} selection={selection} select={walk ? () => {} : select} />
      {level.stairs?.map((stair) => (
        <StairMesh key={stair.id} stair={stair} levels={levels} selection={selection} select={select} />
      ))}
      {level.ramps?.map((ramp) => (
        <RampMesh key={ramp.id} ramp={ramp} selection={selection} select={select} />
      ))}
      {level.seatingSections?.map((section) => (
        <SeatingMesh key={section.id} section={section} selection={selection} select={select} />
      ))}
      {!!rails.length && <RailingInstances details={rails} select={select} />}
      {level.details
        ?.filter((detail) => !railIds.has(detail.id))
        .map((detail) => (
          <ArchitecturalDetailMesh key={detail.id} detail={detail} selection={selection} select={select} />
        ))}
      {ceilings.map((panel) => (
        <CeilingSurface key={`ceiling-${panel.room.id}`} {...panel} />
      ))}
    </>
  )
}
