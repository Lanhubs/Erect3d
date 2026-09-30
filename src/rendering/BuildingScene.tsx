import { useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, type DirectionalLight } from 'three'
import { defaultRoof, type Building, type Level, type Selection } from '../domain/types'
import { topLevel } from '../domain/levels'
import { WallMesh } from './WallMesh'
import { WalkController } from './WalkController'
import { RoofAssembly } from './RoofAssembly'
import { SiteEnvironment } from './SiteEnvironment'
import { RoomSurface } from './RoomSurface'
import { SectionPlane } from './SectionPlane'
import { SlabMesh } from './SlabMesh'
import { ColumnMesh } from './ColumnMesh'
import { InspectionCamera } from './InspectionCamera'
import { StairMesh } from './StairMesh'
import { siteBounds } from '../geometry/site'

export type BuildingView = 'current' | 'building' | 'exploded'
type Props = { building: Building; activeLevelId: string; view: BuildingView; isolateId: string | null;
  selection: Selection; select: (selection: Selection) => void; walk: boolean; top: boolean; endWalk: () => void;
  ceiling: boolean; roofShown: boolean; sectionHeight: number | null; verticalSection: number | null;
  quality: 'auto' | 'performance' | 'balanced' | 'high'; openDoors: ReadonlySet<string>; toggleDoor: (id: string) => void;
  onWalkPosition: (x: number, z: number, yaw: number, level: Level) => void }

function LevelGeometry({ level, levels, selection, select, ceiling, walk, openDoors }: Pick<Props, 'selection' | 'select' | 'ceiling' | 'walk' | 'openDoors'> & { level: Level; levels: Level[] }) {
  const points = level.walls.flatMap(wall => [wall.start, wall.end])
  const bounds = points.length ? { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)) } : null
  const height = Math.max(2.7, ...level.walls.map(wall => wall.height))
  const floorOpenings = level.slabs?.flatMap(slab => slab.openings.map(opening => opening.polygon)) || []
  const nextLevel = levels.filter(item => item.elevation > level.elevation).sort((a, b) => a.elevation - b.elevation)[0]
  const ceilingOpenings = nextLevel?.slabs?.flatMap(slab => slab.openings.map(opening => opening.polygon)) || []
  return <>
    {level.slabs?.map(slab => <SlabMesh key={slab.id} slab={slab} selection={selection} select={select} />)}
    {level.rooms.map(room => <RoomSurface key={room.id} room={room} openings={floorOpenings} select={select} />)}
    {level.walls.map(wall => <WallMesh key={wall.id} wall={wall} doors={level.doors} windows={level.windows}
      passages={level.passages || []} selection={selection} select={select} openDoors={openDoors} />)}
    {level.columns?.map(column => <ColumnMesh key={column.id} column={column} selection={selection} select={select} />)}
    {level.stairs?.map(stair => <StairMesh key={stair.id} stair={stair} levels={levels} selection={selection} select={select} />)}
    {(ceiling || walk) && level.rooms.length > 0 && level.rooms.map(room => <RoomSurface key={`ceiling-${room.id}`} room={room} openings={ceilingOpenings} ceiling />)}
    {(ceiling || walk) && level.rooms.length === 0 && bounds && !ceilingOpenings.length && <mesh position={[(bounds.minX + bounds.maxX) / 2, height + .04, (bounds.minZ + bounds.maxZ) / 2]} receiveShadow>
      <boxGeometry args={[bounds.maxX - bounds.minX, .08, bounds.maxZ - bounds.minZ]} /><meshStandardMaterial color="#e4e1d8" roughness={.95} side={DoubleSide} />
    </mesh>}
  </>
}

export function BuildingScene({ building, activeLevelId, view, isolateId, selection, select, walk, top, endWalk,
  ceiling, roofShown, sectionHeight, verticalSection, quality, openDoors, toggleDoor, onWalkPosition }: Props) {
  const topFloor = topLevel(building)
  const shown = useMemo(() => building.levels.filter(level => level.visible !== false &&
    (walk || (!isolateId || level.id === isolateId) && (view !== 'current' || level.id === activeLevelId))),
  [building.levels, activeLevelId, view, isolateId, walk])
  const points = shown.flatMap(level => level.walls.flatMap(wall => [wall.start, wall.end]))
  const bounds = points.length ? { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)) } : { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }
  const ordered = [...building.levels].sort((a, b) => a.elevation - b.elevation)
  const offset = (level: Level) => view === 'exploded' && !walk ? ordered.findIndex(item => item.id === level.id) * 1.2 : 0
  const topY = Math.max(...shown.map(level => level.elevation + offset(level) + (level.floorToFloorHeight || 3)), 3)
  const roofPoints = topFloor.walls.flatMap(wall => [wall.start, wall.end])
  const roofBounds = roofPoints.length ? { minX: Math.min(...roofPoints.map(point => point.x)), maxX: Math.max(...roofPoints.map(point => point.x)),
    minZ: Math.min(...roofPoints.map(point => point.z)), maxZ: Math.max(...roofPoints.map(point => point.z)),
    top: Math.max(2.7, ...topFloor.walls.map(wall => wall.height)) } : { ...bounds, top: 3 }
  const site = siteBounds(building.siteFence)
  const frameBounds = site ? { minX: Math.min(bounds.minX, site.minX), maxX: Math.max(bounds.maxX, site.maxX),
    minZ: Math.min(bounds.minZ, site.minZ), maxZ: Math.max(bounds.maxZ, site.maxZ) } : bounds
  const frameWidth = Math.max(2, frameBounds.maxX - frameBounds.minX), frameDepth = Math.max(2, frameBounds.maxZ - frameBounds.minZ)
  const center: [number, number, number] = [(frameBounds.minX + frameBounds.maxX) / 2, topY / 2, (frameBounds.minZ + frameBounds.maxZ) / 2]
  const sun = useRef<DirectionalLight>(null)
  useLayoutEffect(() => {
    if (!sun.current) return
    sun.current.target.position.set(center[0], 0, center[2])
    sun.current.target.updateMatrixWorld()
  }, [center[0], center[2]])
  return <>
    <SectionPlane height={sectionHeight} vertical={verticalSection} />
    <InspectionCamera walk={walk} top={top} center={center} span={Math.max(frameWidth, frameDepth, topY * 1.4)} />
    <ambientLight intensity={.28} /><hemisphereLight intensity={.62} color="#f8f2df" groundColor="#687367" />
    <directionalLight ref={sun} position={[center[0] - 8, center[1] + 18, center[2] + 7]} intensity={2.25} castShadow={quality !== 'performance'}
      shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]}
      shadow-camera-left={-Math.max(frameWidth, frameDepth) / 2 - 5} shadow-camera-right={Math.max(frameWidth, frameDepth) / 2 + 5}
      shadow-camera-top={Math.max(frameWidth, frameDepth) / 2 + 5} shadow-camera-bottom={-Math.max(frameWidth, frameDepth) / 2 - 5}
      shadow-bias={-.00015} color="#f8ebd0" />
    {shown.map(level => <group key={level.id} name={`level:${level.id}`} position={[0, level.elevation + offset(level), 0]}>
      <LevelGeometry level={level} levels={building.levels} selection={selection} select={select} ceiling={ceiling} walk={walk} openDoors={openDoors} />
    </group>)}
    {roofShown && shown.some(level => level.id === topFloor.id) && topFloor.walls.length > 0 &&
      <group position={[0, topFloor.elevation + offset(topFloor), 0]}><RoofAssembly bounds={roofBounds} roof={building.roof || topFloor.roof || defaultRoof} /></group>}
    <SiteEnvironment bounds={{ ...frameBounds, top: topY }} slabThickness={building.levels[0].slabThickness} siteFence={building.siteFence} />
    <WalkController levels={shown} startLevelId={activeLevelId} active={walk} siteFence={building.siteFence}
      onUnlock={endWalk} openDoors={openDoors} onToggleDoor={toggleDoor}
      onPosition={onWalkPosition} />
  </>
}
