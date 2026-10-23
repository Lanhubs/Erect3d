import { memo, useEffect, useMemo } from 'react'
import type { Building, Level, Selection } from '../domain/types'
import type { BuildingSystem } from '../domain/buildingSystems'
import { validateSystems } from '../domain/systemValidation'
import { compileSystem } from '../geometry/systemCompiler'
import { systemMassGeometry } from '../geometry/systemMass'
import { EntityInstances, spatialBatches } from './EntityInstances'
import { LinkedFloors } from './LinkedFloors'
import { SceneIssue } from './SceneIssue'
import { visibleSystems, type VisibleSystem } from '../geometry/systemVisibility'
import { ArticulationSystem } from './ArticulationSystem'
import { SpiralStairSystem } from './SpiralStairSystem'
function Mass({
  system,
  select,
}: {
  system: Extract<BuildingSystem, { kind: 'massing' }>
  select: (s: Selection) => void
}) {
  const geometry = useMemo(() => systemMassGeometry(system), [system])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation()
        select({ kind: 'architecture', id: system.id })
      }}
    >
      <meshStandardMaterial color={system.color} roughness={0.8} />
    </mesh>
  )
}
const System = memo(function System({
  system,
  level,
  levels,
  select,
}: {
  system: VisibleSystem
  level: Level
  levels: Level[]
  select: (s: Selection) => void
}) {
  const elevations = levels.map((l) => `${l.id}:${l.elevation}`).join('|')
  const data = useMemo(
    () => compileSystem(system, level, system.renderSlice, levels),
    [system, level.walls, level.doors, level.windows, level.passages, elevations],
  )
  return (
    <group name={`architectural-system:${system.id}`}>
      {system.kind === 'spiral-stair' && data.spiral && (
        <SpiralStairSystem system={system} plan={data.spiral} select={select} />
      )}
      {system.kind === 'articulation' && data.articulation && (
        <ArticulationSystem system={system} parts={data.articulation} select={select} />
      )}
      {system.kind === 'massing' && <Mass system={system} select={select} />}
      {[...spatialBatches(data.parts)].map(([zone, parts]) => (
        <EntityInstances key={`solid:${zone}`} parts={parts} color={system.color} select={select} />
      ))}
      {[...spatialBatches(data.glass)].map(([zone, parts]) => (
        <EntityInstances
          key={`glass:${zone}`}
          parts={parts}
          color="#a4c7d2"
          material="facade-glass"
          shadow={false}
          select={select}
        />
      ))}
      {[...spatialBatches(data.frame)].map(([zone, parts]) => (
        <EntityInstances
          key={`frame:${zone}`}
          parts={parts}
          color={system.color}
          material="metal"
          select={select}
        />
      ))}
    </group>
  )
})
export function BuildingSystems({
  building,
  shownIds,
  select,
  roofShown,
  singleLevel = false,
}: {
  building: Building
  shownIds: ReadonlySet<string>
  select: (s: Selection) => void
  roofShown: boolean
  singleLevel?: boolean
}) {
  const errors = useMemo(() => validateSystems(building), [building.systems, building.levels])
  if (errors.length) return <SceneIssue id="building-systems" message={errors.join(' · ')} />
  return (
    <group name="semantic-building-systems">
      <SceneIssue id="building-systems" message="" />
      {visibleSystems(building, shownIds, singleLevel).map((system) => {
        if (system.kind === 'typical-floors') {
          const template = building.levels.find((l) => l.id === system.templateLevelId)
          return template ? (
            <LinkedFloors
              key={system.id}
              group={system}
              template={template}
              building={building}
              select={select}
              roofShown={roofShown}
            />
          ) : null
        }
        const elevation = building.levels.find((l) => l.id === system.levelId)?.elevation || 0
        return (
          <group key={system.id} position={[0, elevation, 0]}>
            <System
              system={system}
              level={building.levels.find((l) => l.id === system.levelId)!}
              levels={building.levels}
              select={select}
            />
          </group>
        )
      })}
    </group>
  )
}
