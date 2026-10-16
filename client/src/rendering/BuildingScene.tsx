import {LevelGeometry} from './LevelGeometry'
import {BuildingSystems} from './BuildingSystems'
import {architecturalBounds,levelWithSystemVoids} from '../geometry/systemCompiler'
import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { type DirectionalLight } from 'three'
import { type Building, type Level, type Selection } from '../domain/types'
import { WalkController } from './WalkController'
import { BuildingRoofs } from './BuildingRoofs'
import { SiteEnvironment } from './SiteEnvironment'
import { SectionPlane } from './SectionPlane'
import { InspectionCamera } from './InspectionCamera'
import type { CameraPreset } from './InspectionCamera'
import { siteBounds } from '../geometry/site'
import {buildingLight} from '../geometry/buildingLight'
import { ElementGizmo } from './ElementGizmo'
import { levelBoundsPoints } from '../geometry/elementBounds'
import {ModelClipGroup} from './ModelClipGroup'
import {useGraphicsSettings} from './GraphicsRuntime'
import {qualityProfiles} from './graphicsQuality'
import {createRoofGeometryCache} from '../domain/roofGeometryCache'
import {roofElevation} from '../geometry/roofElevation'
import type { WalkOptions, WalkViewpoint } from '../walkthrough/types'

export type BuildingView = 'current' | 'building' | 'exploded'
type Props = { building: Building; activeLevelId: string; view: BuildingView; isolateId: string | null;
  selection: Selection; select: (selection: Selection) => void; walk: boolean; top: boolean;
  ceiling: boolean; roofShown: boolean; sectionHeight: number | null; verticalSection: number | null;
  quality: 'auto' | 'performance' | 'balanced' | 'high'; openDoors: ReadonlySet<string>; toggleDoor: (id: string) => void;
  roofCutaway?:boolean;
  onWalkPosition: (x: number, z: number, yaw: number, level: Level, foot: number, pitch: number) => void; cameraPreset?: CameraPreset;
  walkOptions: WalkOptions; onCapture: (locked: boolean, dragging?: boolean) => void; viewpoints?: WalkViewpoint[];contextShown?:boolean }

function BuildingSceneRenderer({ building, activeLevelId, view, isolateId, selection, select, walk, top,
  ceiling, roofShown,roofCutaway, sectionHeight, verticalSection, quality, openDoors, toggleDoor, onWalkPosition, cameraPreset, walkOptions, onCapture, viewpoints,contextShown }: Props) {
  const {tier,optimized}=useGraphicsSettings(),effectiveQuality=optimized?tier:quality==='auto'?'balanced':quality
  const curtainIds=useMemo(()=>new Set(building.systems?.systems.flatMap(s=>s.kind==='curtain-wall'&&s.visible!==false?s.wallIds||[]:[])||[]),[building.systems])
  const generatedIds=useMemo(()=>new Set(building.architecture?.generatedIds || []),[building.architecture?.generatedIds])
  const shown = useMemo(() => building.levels.filter(level => (walk || level.visible !== false) &&
    (walk || (!isolateId || level.id === isolateId) && (view !== 'current' || level.id === activeLevelId))),
  [building.levels, activeLevelId, view, isolateId, walk])
  const preparedLevels=useMemo(()=>building.levels.map(level=>levelWithSystemVoids(level,building)),[building.levels,building.systems])
  const shownGeometry=useMemo(()=>shown.map(level=>preparedLevels.find(l=>l.id===level.id)!),[shown,preparedLevels])
  const singleLevel=!walk&&(view==='current'||!!isolateId)
  const systemBounds=useMemo(()=>singleLevel?{points:[],top:0}:architecturalBounds(building),[singleLevel,building.systems,building.levels])
  const points = [...systemBounds.points,...shown.flatMap(level => levelBoundsPoints(level, building.levels))]
  const bounds = points.length ? { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)) } : { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }
  const ordered = [...building.levels].sort((a, b) => a.elevation - b.elevation)
  const offset = (level: Level) => view === 'exploded' && !walk ? ordered.findIndex(item => item.id === level.id) * 1.2 : 0
  const roofCache=useMemo(()=>createRoofGeometryCache(),[]),roofSections=roofCache(building)
  const roofTop=useMemo(()=>roofShown?roofElevation(roofSections,shown):0,[roofSections,shown,roofShown])
  const topY = Math.max(systemBounds.top,roofTop,...shown.map(level => level.elevation + offset(level) + Math.max(level.floorToFloorHeight || 3,...level.walls.map(wall=>wall.height))),
    building.architecture?(building.architecture.brief.clearance+building.architecture.brief.roofRise):3)
  const site = siteBounds(building.siteFence)
  const frameBounds = site ? { minX: Math.min(bounds.minX, site.minX), maxX: Math.max(bounds.maxX, site.maxX),
    minZ: Math.min(bounds.minZ, site.minZ), maxZ: Math.max(bounds.maxZ, site.maxZ) } : bounds
  const frameWidth = Math.max(2, frameBounds.maxX - frameBounds.minX), frameDepth = Math.max(2, frameBounds.maxZ - frameBounds.minZ)
  const center: [number, number, number] = [(frameBounds.minX + frameBounds.maxX) / 2, topY / 2, (frameBounds.minZ + frameBounds.maxZ) / 2]
  const sportsKind = building.levels.some(level => level.rooms.some(room => room.category === 'football-pitch')) ? 'stadium'
    : building.levels.some(level => level.rooms.some(room => room.category === 'table-tennis-hall' || room.category==='basketball-court')) ? 'arena' : null
  const sun = useRef<DirectionalLight>(null)
  const lighting=useMemo(()=>buildingLight({...frameBounds,bottom:Math.min(0,...shown.map(l=>l.elevation)),top:topY}),[frameBounds.minX,frameBounds.maxX,frameBounds.minZ,frameBounds.maxZ,topY,shown])
  useLayoutEffect(() => {
    if (!sun.current) return
    sun.current.target.position.set(...lighting.target)
    sun.current.target.updateMatrixWorld()
  }, [lighting])
  return <>
    <SectionPlane height={sectionHeight} vertical={verticalSection} />
    {!walk && selection && <ElementGizmo building={building} selection={selection} exploded={view === 'exploded'} />}
    <InspectionCamera walk={walk} top={top} center={center} span={Math.max(frameWidth, frameDepth, topY * 1.4)}
      preset={cameraPreset} sportsKind={sportsKind} />
    <ambientLight intensity={walk ? .48 : .28} /><hemisphereLight intensity={walk ? .85 : .62} color="#f8f2df" groundColor="#687367" />
    <directionalLight ref={sun} position={lighting.position} intensity={2.25} castShadow
      shadow-mapSize={[qualityProfiles[effectiveQuality].shadowSize,qualityProfiles[effectiveQuality].shadowSize]}
      shadow-camera-left={lighting.left} shadow-camera-right={lighting.right}
      shadow-camera-top={lighting.top} shadow-camera-bottom={lighting.bottom} shadow-camera-near={lighting.near} shadow-camera-far={lighting.far}
      shadow-bias={-.00015} shadow-normalBias={Math.max(.002,Math.min(.04,(lighting.right-lighting.left)/qualityProfiles[effectiveQuality].shadowSize*.5))} color="#f8ebd0" />
    <ModelClipGroup height={sectionHeight} vertical={verticalSection}>{shownGeometry.map(level => <group key={level.id} name={`level:${level.id}`} position={[0, level.elevation + offset(level), 0]}>
      <LevelGeometry level={level} levels={preparedLevels} generatedIds={generatedIds} curtainIds={curtainIds} selection={selection} select={walk ? () => {} : select} ceiling={ceiling} roofShown={roofShown} walk={walk} openDoors={openDoors} />
    </group>)}
    <BuildingSystems building={building} shownIds={new Set(shown.map(l=>l.id))} select={walk?()=>{}:select} roofShown={roofShown} singleLevel={singleLevel}/>
    {roofShown && <BuildingRoofs building={building} shown={shown} offset={offset} cutaway={roofCutaway} singleLevel={singleLevel}/>}
    </ModelClipGroup>
    <SiteEnvironment bounds={{ ...frameBounds, top: topY }} slabThickness={building.levels[0].slabThickness} siteFence={building.siteFence} baseShown={building.levels[0].autoSlab !== false} contextShown={contextShown}
      onFenceSelect={!walk && building.siteFence ? () => select({ kind: 'fence', id: building.siteFence!.id }) : undefined} />
    <WalkController levels={shownGeometry} systems={building.systems?.systems} startLevelId={activeLevelId} active={walk} siteFence={building.siteFence}
      options={walkOptions} onCapture={onCapture} viewpoints={viewpoints || building.walkViewpoints} openDoors={openDoors} onToggleDoor={toggleDoor}
      onPosition={onWalkPosition} />
  </>
}
export const BuildingScene = memo(BuildingSceneRenderer)
