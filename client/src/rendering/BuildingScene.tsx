import {BuildingSystems} from './BuildingSystems'
import {architecturalBounds,levelWithSystemVoids} from '../geometry/systemCompiler'
import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, type DirectionalLight } from 'three'
import { type Building, type Level, type Selection } from '../domain/types'
import { WallMesh } from './WallMesh'
import { WalkController } from './WalkController'
import { BuildingRoofs } from './BuildingRoofs'
import { SiteEnvironment } from './SiteEnvironment'
import { RoomSurface } from './RoomSurface'
import { SectionPlane } from './SectionPlane'
import { SlabMesh } from './SlabMesh'
import { ColumnMesh } from './ColumnMesh'
import { InspectionCamera } from './InspectionCamera'
import type { CameraPreset } from './InspectionCamera'
import { StairMesh } from './StairMesh'
import { RampMesh } from './RampMesh'
import { SeatingMesh } from './SeatingMesh'
import { ArchitecturalDetailMesh } from './ArchitecturalDetailMesh'
import { siteBounds } from '../geometry/site'
import { wallBoundsPoints } from '../geometry/math'
import { ElementGizmo } from './ElementGizmo'
import { VerandaMesh } from './VerandaMesh'
import { levelBoundsPoints } from '../geometry/elementBounds'
import { FurnitureMeshes } from '../furniture/FurnitureMeshes'
import {ModelClipGroup} from './ModelClipGroup'
import {ArchitectureFacade,batchedFacadeIds} from './ArchitectureFacade'
import {ColumnInstances} from './ColumnInstances'
import {useGraphicsSettings} from './GraphicsRuntime'
import {qualityProfiles} from './graphicsQuality'
import {RailingInstances} from './RailingInstances'
import type { WalkOptions, WalkViewpoint } from '../walkthrough/types'

export type BuildingView = 'current' | 'building' | 'exploded'
type Props = { building: Building; activeLevelId: string; view: BuildingView; isolateId: string | null;
  selection: Selection; select: (selection: Selection) => void; walk: boolean; top: boolean;
  ceiling: boolean; roofShown: boolean; sectionHeight: number | null; verticalSection: number | null;
  quality: 'auto' | 'performance' | 'balanced' | 'high'; openDoors: ReadonlySet<string>; toggleDoor: (id: string) => void;
  roofCutaway?:boolean;
  onWalkPosition: (x: number, z: number, yaw: number, level: Level, foot: number, pitch: number) => void; cameraPreset?: CameraPreset;
  walkOptions: WalkOptions; onCapture: (locked: boolean, dragging?: boolean) => void; viewpoints?: WalkViewpoint[] }

function LevelGeometry({ level, levels, generatedIds, selection, select, ceiling, roofShown, walk, openDoors }: Pick<Props, 'selection' | 'select' | 'ceiling' | 'roofShown' | 'walk' | 'openDoors'> & { level: Level; levels: Level[];generatedIds:ReadonlySet<string> }) {
  const {optimized}=useGraphicsSettings()
  const facadeIds=useMemo(()=>optimized?batchedFacadeIds(level,generatedIds,selection):new Set<string>(),[level,generatedIds,selection,optimized])
  const rails=useMemo(()=>optimized?(level.details || []).filter(detail=>generatedIds.has(detail.id) && detail.kind==='railing' && detail.material==='glass' && selection?.id!==detail.id):[],[optimized,level.details,generatedIds,selection?.id])
  const railIds=useMemo(()=>new Set(rails.map(detail=>detail.id)),[rails])
  const points = wallBoundsPoints(level.walls)
  const bounds = points.length ? { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)) } : null
  const height = Math.max(2.7, ...level.walls.map(wall => wall.height))
  const floorOpenings = level.slabs?.flatMap(slab => slab.openings.map(opening => opening.polygon)) || []
  const nextLevel = levels.filter(item => item.elevation > level.elevation).sort((a, b) => a.elevation - b.elevation)[0]
  const ceilingOpenings = nextLevel?.slabs?.flatMap(slab => slab.openings.map(opening => opening.polygon)) || []
  return <>
    {level.slabs?.map(slab => <SlabMesh key={slab.id} slab={slab} selection={selection} select={select} />)}
    {level.rooms.map(room => <RoomSurface key={room.id} room={room} openings={floorOpenings} select={select} />)}
    {!!facadeIds.size && <ArchitectureFacade level={level} ids={facadeIds} color="#b7b6af" select={select}/>}
    {level.walls.filter(wall=>!facadeIds.has(wall.id)).map(wall => <WallMesh key={wall.id} wall={wall} doors={level.doors} windows={level.windows}
      passages={level.passages || []} selection={selection} select={select} openDoors={openDoors} />)}
    {level.doors.filter(door => door.veranda).map(door => <VerandaMesh key={`veranda:${door.id}`} level={level} door={door} roof={level.roof} roofShown={roofShown} selection={selection} select={select} />)}
    {optimized && <ColumnInstances columns={level.columns || []} selection={selection} select={select}/>}
    {level.columns?.filter(column=>!optimized || selection?.id===column.id).map(column => <ColumnMesh key={column.id} column={column} selection={selection} select={select} />)}
    <FurnitureMeshes level={level} selection={selection} select={walk ? () => {} : select} />
    {level.stairs?.map(stair => <StairMesh key={stair.id} stair={stair} levels={levels} selection={selection} select={select} />)}
    {level.ramps?.map(ramp => <RampMesh key={ramp.id} ramp={ramp} selection={selection} select={select} />)}
    {level.seatingSections?.map(section => <SeatingMesh key={section.id} section={section} selection={selection} select={select} />)}
    {!!rails.length && <RailingInstances details={rails} select={select}/>}
    {level.details?.filter(detail=>!railIds.has(detail.id)).map(detail => <ArchitecturalDetailMesh key={detail.id} detail={detail} selection={selection} select={select} />)}
    {(ceiling || walk) && level.rooms.length > 0 && level.rooms.filter(room =>
      room.category !== 'football-pitch' && room.category !== 'table-tennis-hall' && room.category!=='basketball-court').map(room =>
      <RoomSurface key={`ceiling-${room.id}`} room={room} openings={ceilingOpenings} ceiling />)}
    {(ceiling || walk) && level.autoSlab !== false && level.rooms.length === 0 && bounds && !ceilingOpenings.length && <mesh position={[(bounds.minX + bounds.maxX) / 2, height + .04, (bounds.minZ + bounds.maxZ) / 2]} receiveShadow>
      <boxGeometry args={[bounds.maxX - bounds.minX, .08, bounds.maxZ - bounds.minZ]} /><meshStandardMaterial color="#e4e1d8" roughness={.95} side={DoubleSide} />
    </mesh>}
  </>
}

function BuildingSceneRenderer({ building, activeLevelId, view, isolateId, selection, select, walk, top,
  ceiling, roofShown,roofCutaway, sectionHeight, verticalSection, quality, openDoors, toggleDoor, onWalkPosition, cameraPreset, walkOptions, onCapture, viewpoints }: Props) {
  const {tier,optimized}=useGraphicsSettings(),effectiveQuality=optimized?tier:quality==='auto'?'balanced':quality
  const generatedIds=useMemo(()=>new Set(building.architecture?.generatedIds || []),[building.architecture?.generatedIds])
  const shown = useMemo(() => building.levels.filter(level => (walk || level.visible !== false) &&
    (walk || (!isolateId || level.id === isolateId) && (view !== 'current' || level.id === activeLevelId))),
  [building.levels, activeLevelId, view, isolateId, walk])
  const systemBounds=useMemo(()=>architecturalBounds(building),[building.systems,building.levels])
  const points = [...systemBounds.points,...shown.flatMap(level => levelBoundsPoints(level, building.levels))]
  const bounds = points.length ? { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)) } : { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }
  const ordered = [...building.levels].sort((a, b) => a.elevation - b.elevation)
  const offset = (level: Level) => view === 'exploded' && !walk ? ordered.findIndex(item => item.id === level.id) * 1.2 : 0
  const topY = Math.max(systemBounds.top,...shown.map(level => level.elevation + offset(level) + Math.max(level.floorToFloorHeight || 3,...level.walls.map(wall=>wall.height))),
    building.architecture?(building.architecture.brief.clearance+building.architecture.brief.roofRise):3)
  const site = siteBounds(building.siteFence)
  const frameBounds = site ? { minX: Math.min(bounds.minX, site.minX), maxX: Math.max(bounds.maxX, site.maxX),
    minZ: Math.min(bounds.minZ, site.minZ), maxZ: Math.max(bounds.maxZ, site.maxZ) } : bounds
  const frameWidth = Math.max(2, frameBounds.maxX - frameBounds.minX), frameDepth = Math.max(2, frameBounds.maxZ - frameBounds.minZ)
  const center: [number, number, number] = [(frameBounds.minX + frameBounds.maxX) / 2, topY / 2, (frameBounds.minZ + frameBounds.maxZ) / 2]
  const sportsKind = building.levels.some(level => level.rooms.some(room => room.category === 'football-pitch')) ? 'stadium'
    : building.levels.some(level => level.rooms.some(room => room.category === 'table-tennis-hall' || room.category==='basketball-court')) ? 'arena' : null
  const sun = useRef<DirectionalLight>(null)
  useLayoutEffect(() => {
    if (!sun.current) return
    sun.current.target.position.set(center[0], 0, center[2])
    sun.current.target.updateMatrixWorld()
  }, [center[0], center[2]])
  return <>
    <SectionPlane height={sectionHeight} vertical={verticalSection} />
    {!walk && selection && <ElementGizmo building={building} selection={selection} exploded={view === 'exploded'} />}
    <InspectionCamera walk={walk} top={top} center={center} span={Math.max(frameWidth, frameDepth, topY * 1.4)}
      preset={cameraPreset} sportsKind={sportsKind} />
    <ambientLight intensity={walk ? .48 : .28} /><hemisphereLight intensity={walk ? .85 : .62} color="#f8f2df" groundColor="#687367" />
    <directionalLight ref={sun} position={[center[0] - 8, center[1] + 18, center[2] + 7]} intensity={2.25} castShadow
      shadow-mapSize={[qualityProfiles[effectiveQuality].shadowSize,qualityProfiles[effectiveQuality].shadowSize]}
      shadow-camera-left={-Math.max(frameWidth, frameDepth) / 2 - 5} shadow-camera-right={Math.max(frameWidth, frameDepth) / 2 + 5}
      shadow-camera-top={Math.max(frameWidth, frameDepth) / 2 + 5} shadow-camera-bottom={-Math.max(frameWidth, frameDepth) / 2 - 5}
      shadow-bias={-.00015} color="#f8ebd0" />
    <ModelClipGroup height={sectionHeight} vertical={verticalSection}>{shown.map(level => <group key={level.id} name={`level:${level.id}`} position={[0, level.elevation + offset(level), 0]}>
      <LevelGeometry level={levelWithSystemVoids(level,building)} levels={building.levels} generatedIds={generatedIds} selection={selection} select={walk ? () => {} : select} ceiling={ceiling} roofShown={roofShown} walk={walk} openDoors={openDoors} />
    </group>)}
    <BuildingSystems building={building} shownIds={new Set(shown.map(l=>l.id))} select={walk?()=>{}:select}/>
    {roofShown && <BuildingRoofs building={building} shown={shown} offset={offset} cutaway={roofCutaway}/>}
    </ModelClipGroup>
    <SiteEnvironment bounds={{ ...frameBounds, top: topY }} slabThickness={building.levels[0].slabThickness} siteFence={building.siteFence} baseShown={building.levels[0].autoSlab !== false}
      onFenceSelect={!walk && building.siteFence ? () => select({ kind: 'fence', id: building.siteFence!.id }) : undefined} />
    <WalkController levels={shown} startLevelId={activeLevelId} active={walk} siteFence={building.siteFence}
      options={walkOptions} onCapture={onCapture} viewpoints={viewpoints || building.walkViewpoints} openDoors={openDoors} onToggleDoor={toggleDoor}
      onPosition={onWalkPosition} />
  </>
}
export const BuildingScene = memo(BuildingSceneRenderer)
