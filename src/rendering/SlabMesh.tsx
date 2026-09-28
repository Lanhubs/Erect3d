import { useEffect, useMemo } from 'react'
import { ExtrudeGeometry, Path, Shape } from 'three'
import type { Selection, Slab } from '../domain/types'
import { materialRoughness } from './materials'
import { floorTexture } from './textures'
import { pointerCursor } from './pointerCursor'

export function SlabMesh({ slab, selection, select }: { slab: Slab; selection: Selection; select: (selection: Selection) => void }) {
  const geometry = useMemo(() => {
    const outline = new Shape()
    slab.polygon.forEach((point, index) => index ? outline.lineTo(point.x, point.z) : outline.moveTo(point.x, point.z))
    outline.closePath()
    for (const opening of slab.openings) {
      const hole = new Path()
      opening.polygon.forEach((point, index) => index ? hole.lineTo(point.x, point.z) : hole.moveTo(point.x, point.z))
      hole.closePath(); outline.holes.push(hole)
    }
    const result = new ExtrudeGeometry(outline, { depth: slab.thickness, bevelEnabled: false, curveSegments: 4 })
    result.computeVertexNormals()
    return result
  }, [slab.polygon, slab.openings, slab.thickness])
  useEffect(() => () => geometry.dispose(), [geometry])
  const color = slab.color || (slab.structuralMaterial === 'timber' ? '#967759' : slab.structuralMaterial === 'steel-deck' ? '#89939a' : '#a9aaa5')
  return <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, slab.elevation, 0]}
    castShadow receiveShadow onPointerOver={() => pointerCursor(true)} onPointerOut={() => pointerCursor(false)}
    onClick={event => { event.stopPropagation(); select({ kind: 'slab', id: slab.id }) }}>
    <meshStandardMaterial attach="material-0" color={selection?.id === slab.id ? '#c3a874' : slab.color || '#ffffff'}
      map={floorTexture(slab.finishMaterial)} roughness={materialRoughness[slab.finishMaterial]} />
    <meshStandardMaterial attach="material-1" color={selection?.id === slab.id ? '#c3a874' : color}
      roughness={slab.structuralMaterial === 'steel-deck' ? .54 : .88} />
  </mesh>
}
