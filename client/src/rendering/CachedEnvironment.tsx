import {useEffect} from 'react'
import {useThree} from '@react-three/fiber'
import {Scene,Mesh,SphereGeometry,PlaneGeometry,MeshBasicMaterial,BackSide,DoubleSide,Color,PMREMGenerator} from 'three'
import {useGraphicsSettings} from './GraphicsRuntime'
// One static reflection probe per viewport. Camera movement never recaptures it.
export function CachedEnvironment(){
  const {gl,scene,invalidate}=useThree(),{optimized,tier}=useGraphicsSettings()
  useEffect(()=>{
    if(!optimized)return
    let cancelled=false,release=()=>{}
    const prepare=async()=>{
      const native=Boolean((gl as unknown as {isWebGPURenderer?:boolean}).isWebGPURenderer)
      const Generator=native?(await import('three/webgpu')).PMREMGenerator:PMREMGenerator
      if(cancelled)return
      const generator=new Generator(gl as never),probe=new Scene(),geometry=new SphereGeometry(40,24,12)
      const material=new MeshBasicMaterial({color:'#dce9f1',side:BackSide}),sky=new Mesh(geometry,material)
      probe.add(sky);probe.background=new Color('#c8d5e0')
      // Broad bright surfaces supply sky/ground contrast without dynamic lights.
      const groundGeometry=new PlaneGeometry(100,100),groundMaterial=new MeshBasicMaterial({color:'#72776d',side:DoubleSide}),ground=new Mesh(groundGeometry,groundMaterial)
      ground.rotation.x=-Math.PI/2;ground.position.y=-2;probe.add(ground)
      const target=generator.fromScene(probe,.04,.1,100,{size:tier==='high'?256:128})
      const previous=scene.environment;scene.environment=target.texture;scene.environmentIntensity=.65
      generator.dispose();geometry.dispose();groundGeometry.dispose();material.dispose();groundMaterial.dispose();invalidate()
      release=()=>{if(scene.environment===target.texture)scene.environment=previous;target.dispose()}
    }
    void prepare().catch(()=>{ /* Direct sun/hemisphere lighting remains available. */ })
    return()=>{cancelled=true;release()}
  },[gl,scene,optimized,tier,invalidate])
  return null
}
