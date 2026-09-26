import { useMemo } from 'react'
import type { Door, Passage, Selection, Wall, WindowUnit } from '../domain/types'
import { atWall, wallLength } from '../geometry/math'
import { wallRect, wallSolids } from '../geometry/walls'
import { materialColor, materialRoughness } from './materials'
import { wallTexture } from './wallTextures'
import { DoorMesh } from './DoorMesh'

type Props = { wall: Wall; doors: Door[]; windows: WindowUnit[]; passages: Passage[]; selection: Selection; select: (selection: Selection) => void; openDoors: ReadonlySet<string> }
export function WallMesh({ wall, doors, windows, passages, selection, select, openDoors }: Props) {
  const hover = (active: boolean) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas')
    if (canvas) canvas.style.cursor = active ? 'pointer' : ''
  }
  const solids = useMemo(() => wallSolids(wall, doors, windows, passages), [wall, doors, windows, passages])
  const angle = -Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x)
  const len = wallLength(wall)
  const selected = selection?.kind === 'wall' && selection.id === wall.id
  return <group>
    {solids.map((solid, index) => {
      const rect = wallRect(wall, solid)
      return <group key={index} onClick={event => { event.stopPropagation(); select({ kind: 'wall', id: wall.id }) }}
        onPointerOver={event => { event.stopPropagation(); hover(true) }} onPointerOut={() => hover(false)}>
        <mesh position={rect.center} rotation={[0, rect.rotation, 0]} castShadow receiveShadow>
          <boxGeometry args={rect.size} />
          <meshStandardMaterial map={wallTexture(wall.material)} color={selected ? '#b6a276' : wall.color || materialColor[wall.material]}
            roughness={materialRoughness[wall.material]} />
        </mesh>
        {solid.bottom === 0 && <mesh position={[rect.center[0], .045, rect.center[2]]} rotation={[0, rect.rotation, 0]} castShadow>
          <boxGeometry args={[rect.size[0], .09, wall.thickness + .018]} />
          <meshStandardMaterial color="#a4a299" roughness={.76} />
        </mesh>}
      </group>
    })}
    {doors.filter(door => door.wallId === wall.id && door.offset < len).map(door =>
      <DoorMesh key={door.id} door={door} wall={wall} selection={selection} select={select} open={openDoors.has(door.id)} />)}
    {passages.filter(item => item.wallId === wall.id).map(item => <group key={item.id}
      position={[atWall(wall, item.offset + item.width / 2).x, item.height / 2, atWall(wall, item.offset + item.width / 2).z]}
      rotation={[0, angle, 0]} onClick={event => { event.stopPropagation(); select({ kind: 'passage', id: item.id }) }}>
      {[-1, 1].map(side => <mesh key={side} position={[side * item.width / 2, 0, 0]}><boxGeometry args={[.06, item.height, wall.thickness + .02]} />
        <meshStandardMaterial color={selection?.id === item.id ? '#b69c6d' : '#a9a79e'} /></mesh>)}
      <mesh position={[0, item.height / 2, 0]}><boxGeometry args={[item.width, .06, wall.thickness + .02]} />
        <meshStandardMaterial color="#a9a79e" /></mesh>
    </group>)}
    {windows.filter(item => item.wallId === wall.id).map(item => {
      const center = atWall(wall, item.offset + item.width / 2)
      return <group key={item.id} position={[center.x, item.sill + item.height / 2, center.z]} rotation={[0, angle, 0]}
        onClick={event => { event.stopPropagation(); select({ kind: 'window', id: item.id }) }}
        onPointerOver={event => { event.stopPropagation(); hover(true) }} onPointerOut={() => hover(false)}>
        {[-1, 1].map(side => <mesh key={side} position={[side * item.width / 2, 0, 0]}>
          <boxGeometry args={[.065, item.height + .07, .09]} /><meshStandardMaterial color={selection?.id === item.id ? '#b69c6d' : item.frame === 'timber' ? '#765a43' : '#555d5c'} metalness={item.frame === 'timber' ? .05 : .55} roughness={.35} /></mesh>)}
        {[-1, 1].map(side => <mesh key={side} position={[0, side * item.height / 2, 0]}>
          <boxGeometry args={[item.width, .065, .09]} /><meshStandardMaterial color="#555d5c" metalness={.55} roughness={.35} /></mesh>)}
        <mesh><boxGeometry args={[item.width - .07, item.height - .07, .075]} />
          <meshPhysicalMaterial color={item.glazing === 'frosted' ? '#d5dee0' : '#a9c0c6'} metalness={.15}
            roughness={item.glazing === 'frosted' ? .65 : .16} transmission={item.glazing === 'frosted' ? .28 : .65}
            thickness={.03} transparent opacity={.65} /></mesh>
        {item.type !== 'fixed' && <mesh position={[0, 0, .08]}><boxGeometry args={[.035, item.height, .035]} /><meshStandardMaterial color="#555d5c" /></mesh>}
        {item.type === 'casement' && <mesh position={[item.width * .38, 0, .12]}>
          <boxGeometry args={[.025, .14, .04]} /><meshStandardMaterial color="#5b615c" metalness={.65} /></mesh>}
      </group>
    })}
  </group>
}
