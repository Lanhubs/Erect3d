import {SharedStandardMaterial} from './SharedStandardMaterial'
import { memo,useMemo } from 'react'
import type { Door, Passage, Selection, Wall, WindowUnit } from '../domain/types'
import { atWall, wallLength, wallTangentAngle } from '../geometry/math'
import { wallRects, wallSolids } from '../geometry/walls'
import { materialColor, materialRoughness } from './materials'
import { wallTexture } from './wallTextures'
import { DoorMesh } from './DoorMesh'
import {WindowMesh} from './WindowMesh'

type Props = { wall: Wall; doors: Door[]; windows: WindowUnit[]; passages: Passage[]; selection: Selection; select: (selection: Selection) => void; openDoors: ReadonlySet<string> }
export const WallMesh=memo(function WallMesh({ wall, doors, windows, passages, selection, select, openDoors }: Props) {
  const hover = (active: boolean) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas')
    if (canvas) canvas.style.cursor = active ? 'pointer' : ''
  }
  const solids = useMemo(() => wallSolids(wall, doors, windows, passages), [wall, doors, windows, passages])
  const len = wallLength(wall)
  const selected = selection?.kind === 'wall' && selection.id === wall.id
  return <group>
    {solids.map((solid, index) => {
      return wallRects(wall, solid).map((rect, segmentIndex) => <group key={`${index}:${segmentIndex}`} onClick={event => { event.stopPropagation(); select({ kind: 'wall', id: wall.id }) }}
        onPointerOver={event => { event.stopPropagation(); hover(true) }} onPointerOut={() => hover(false)}>
        <mesh position={rect.center} rotation={[0, rect.rotation, 0]} castShadow receiveShadow>
          <boxGeometry args={rect.size} />
          <SharedStandardMaterial map={wallTexture(wall.material, rect.size[0], rect.size[1])} color={selected ? '#b6a276' : wall.color || materialColor[wall.material]}
            roughness={materialRoughness[wall.material]} />
        </mesh>
        {solid.bottom === 0 && <mesh position={[rect.center[0], .045, rect.center[2]]} rotation={[0, rect.rotation, 0]} castShadow>
          <boxGeometry args={[rect.size[0], .09, wall.thickness + .018]} />
          <SharedStandardMaterial color="#a4a299" roughness={.76} />
        </mesh>}
      </group>)
    })}
    {doors.filter(door => door.wallId === wall.id && door.offset < len).map(door =>
      <DoorMesh key={door.id} door={door} wall={wall} selection={selection} select={select} open={openDoors.has(door.id)} />)}
    {passages.filter(item => item.wallId === wall.id).map(item => <group key={item.id}
      position={[atWall(wall, item.offset + item.width / 2).x, item.height / 2, atWall(wall, item.offset + item.width / 2).z]}
      rotation={[0, -wallTangentAngle(wall, item.offset + item.width / 2), 0]} onClick={event => { event.stopPropagation(); select({ kind: 'passage', id: item.id }) }}>
      {[-1, 1].map(side => <mesh key={side} position={[side * item.width / 2, 0, 0]}><boxGeometry args={[.06, item.height, wall.thickness + .02]} />
        <SharedStandardMaterial color={selection?.id === item.id ? '#b69c6d' : '#a9a79e'} /></mesh>)}
      <mesh position={[0, item.height / 2, 0]}><boxGeometry args={[item.width, .06, wall.thickness + .02]} />
        <SharedStandardMaterial color="#a9a79e" /></mesh>
    </group>)}
    {windows.filter(item => item.wallId === wall.id).map(item => <WindowMesh key={item.id} wall={wall} window={item} selection={selection} select={select}/>)}
  </group>
})
