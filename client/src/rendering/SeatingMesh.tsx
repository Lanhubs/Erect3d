import { useEffect,useLayoutEffect, useMemo, useRef } from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import { BoxGeometry, InstancedMesh, Matrix4, Object3D,Vector3,PerspectiveCamera } from 'three'
import type { SeatingSection, Selection } from '../domain/types'
import {useGraphicsSettings} from './GraphicsRuntime'
import {useRenderResources} from './RenderResources'

export function SeatingMesh({ section, selection, select }: { section: SeatingSection; selection: Selection; select: (selection: Selection) => void }) {
  const length = Math.hypot(section.end.x - section.start.x, section.end.z - section.start.z)
  const seatsPerRow = Math.max(1, Math.min(1000, section.seatsPerRow))
  const rows = Math.max(1, Math.min(1000, section.rows))
  const growth=section.rowWidthGrowth || 0
  const detailed=seatsPerRow*rows<=40000
  const seatCount = section.aisle || !detailed ? 0 : seatsPerRow * rows
  const selected = selection?.kind === 'seating' && selection.id === section.id
  const yaw = -Math.atan2(section.end.z - section.start.z, section.end.x - section.start.x)
  const tangent = { x: (section.end.x - section.start.x) / Math.max(length, .001), z: (section.end.z - section.start.z) / Math.max(length, .001) }
  const outwardLength = Math.hypot(section.outward.x, section.outward.z) || 1
  const outward = { x: section.outward.x / outwardLength, z: section.outward.z / outwardLength }
  const seatWidth = Math.min(.52, length / seatsPerRow * .88)
  const treadMesh = useRef<InstancedMesh>(null), seatMesh = useRef<InstancedMesh>(null), backMesh = useRef<InstancedMesh>(null)
  const farMesh=useRef<InstancedMesh>(null),{optimized,tier}=useGraphicsSettings(),resources=useRenderResources()
  const {camera,size}=useThree(),far=useRef(false),point=useMemo(()=>new Vector3(),[])
  const geometry = useMemo(() => optimized?resources.geometry('box'):new BoxGeometry(1, 1, 1), [optimized,resources])
  const stepMaterial=resources.material('solid',selected?'#c3a36e':'#9b9b94'),seatMaterial=resources.material('seat',section.seatColor)
  useEffect(()=>{resources.retain(stepMaterial);resources.retain(seatMaterial);return()=>{resources.release(stepMaterial);resources.release(seatMaterial)}},[resources,stepMaterial,seatMaterial])
  useEffect(()=>{const meshes=[treadMesh.current,seatMesh.current,backMesh.current,farMesh.current];return()=>meshes.forEach(mesh=>mesh?.dispose())},[rows,seatCount,geometry])
  useEffect(()=>()=>{if(!optimized)geometry.dispose()},[geometry,optimized])
  useFrame(()=>{
    if(!optimized || !seatMesh.current || !backMesh.current || !farMesh.current || !treadMesh.current)return
    const sphere=treadMesh.current.boundingSphere;if(!sphere)return
    point.copy(sphere.center);treadMesh.current.localToWorld(point)
    const distance=Math.max(1,camera.position.distanceTo(point)),scale=tier==='high'?1.4:tier==='performance'?.75:1
    const pixels=camera instanceof PerspectiveCamera?seatWidth*size.height/(2*distance*Math.tan(camera.fov*Math.PI/360)):4
    if(!detailed)far.current=true
    else if(selection?.id===section.id)far.current=false
    else if(pixels<.85/scale)far.current=true
    else if(pixels>1.3/scale)far.current=false
    seatMesh.current.visible=!far.current;backMesh.current.visible=!far.current;farMesh.current.visible=far.current
  })
  const treadMatrices = useMemo(() => Array.from({ length: rows }, (_, index) => {
    const object = new Object3D(), along = length / 2
    const rise = section.baseElevation + (index + 1) * section.rowRise
    object.position.set(section.start.x + tangent.x * along + outward.x * (index + .5) * section.rowDepth,
      rise / 2, section.start.z + tangent.z * along + outward.z * (index + .5) * section.rowDepth)
    object.rotation.y = yaw
    object.scale.set(length+index*growth, rise, section.rowDepth * .98)
    object.updateMatrix()
    return object.matrix.clone()
  }), [rows, length, growth,section.start.x, section.start.z, section.baseElevation, section.rowRise, section.rowDepth, tangent.x, tangent.z, outward.x, outward.z, yaw])
  const seatMatrices = useMemo(() => {
    const seats: Matrix4[] = [], backs: Matrix4[] = [], object = new Object3D()
    for (let row = 0; row < rows && !section.aisle && detailed; row++) for (let seat = 0; seat < seatsPerRow; seat++) {
      const along = -row*growth/2+(length+row*growth) * (seat + .5) / seatsPerRow
      const x = section.start.x + tangent.x * along + outward.x * (row + .5) * section.rowDepth
      const z = section.start.z + tangent.z * along + outward.z * (row + .5) * section.rowDepth
      const y = section.baseElevation + (row + 1) * section.rowRise + .08
      object.rotation.y = yaw
      object.position.set(x, y, z); object.scale.set(seatWidth, .08, section.rowDepth * .45)
      object.updateMatrix(); seats.push(object.matrix.clone())
      object.position.set(x + outward.x * section.rowDepth * .23, y + .21, z + outward.z * section.rowDepth * .23)
      object.scale.set(seatWidth, .38, .055); object.updateMatrix(); backs.push(object.matrix.clone())
    }
    return { seats, backs }
  }, [rows, seatsPerRow, length,growth, section.start.x, section.start.z, section.baseElevation, section.rowRise,
    section.rowDepth, section.aisle,detailed, tangent.x, tangent.z, outward.x, outward.z, yaw, seatWidth])
  const farMatrices=useMemo(()=>Array.from({length:rows},(_,row)=>{
    const object=new Object3D(),along=length/2
    object.position.set(section.start.x+tangent.x*along+outward.x*(row+.5)*section.rowDepth,
      section.baseElevation+(row+1)*section.rowRise+.08,section.start.z+tangent.z*along+outward.z*(row+.5)*section.rowDepth)
    object.rotation.y=yaw;object.scale.set(length+row*growth,.08,section.rowDepth*.45);object.updateMatrix();return object.matrix.clone()
  }),[rows,length,growth,section.start.x,section.start.z,section.baseElevation,section.rowRise,section.rowDepth,tangent.x,tangent.z,outward.x,outward.z,yaw])
  useLayoutEffect(() => {
    const write = (mesh: InstancedMesh | null, matrices: Matrix4[]) => {
      if (!mesh) return
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    write(treadMesh.current, treadMatrices); write(seatMesh.current, seatMatrices.seats); write(backMesh.current, seatMatrices.backs)
    write(farMesh.current,farMatrices)
  }, [treadMatrices, seatMatrices,farMatrices,geometry,optimized])
  return <group onClick={event => { event.stopPropagation(); select({ kind: 'seating', id: section.id }) }}>
    <instancedMesh ref={treadMesh} args={[geometry, undefined, rows]} material={stepMaterial} dispose={null} castShadow receiveShadow/>
    {!section.aisle && <>
      <instancedMesh ref={seatMesh} args={[geometry, undefined, seatCount]} material={seatMaterial} dispose={null} castShadow receiveShadow/>
      <instancedMesh ref={backMesh} args={[geometry, undefined, seatCount]} material={seatMaterial} dispose={null} castShadow receiveShadow/>
      {(optimized || !detailed) && <instancedMesh ref={farMesh} args={[geometry,undefined,rows]} material={seatMaterial} dispose={null} visible={!detailed} receiveShadow/>}
    </>}
  </group>
}
