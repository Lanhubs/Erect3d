import {Scene,Mesh,SphereGeometry,PlaneGeometry,MeshBasicMaterial,BackSide,DoubleSide,Color,PMREMGenerator,type WebGLRenderer} from 'three'
import type {QualityTier} from './graphicsQuality'
// One static reflection probe per viewport. Camera movement never recaptures it.
export async function prepareEnvironment(gl:WebGLRenderer,scene:Scene,tier:QualityTier){
      const native=Boolean((gl as unknown as {isWebGPURenderer?:boolean}).isWebGPURenderer)
      const Generator=native?(await import('three/webgpu')).PMREMGenerator:PMREMGenerator
      const generator=new Generator(gl as never),probe=new Scene(),geometry=new SphereGeometry(40,24,12)
      const material=new MeshBasicMaterial({color:'#dce9f1',side:BackSide}),sky=new Mesh(geometry,material)
      probe.add(sky);probe.background=new Color('#c8d5e0')
      // Broad bright surfaces supply sky/ground contrast without dynamic lights.
      const groundGeometry=new PlaneGeometry(100,100),groundMaterial=new MeshBasicMaterial({color:'#72776d',side:DoubleSide}),ground=new Mesh(groundGeometry,groundMaterial)
      ground.rotation.x=-Math.PI/2;ground.position.y=-2;probe.add(ground)
      try{
        const target=generator.fromScene(probe,.04,.1,100,{size:tier==='high'?256:128})
        const previous=scene.environment,previousIntensity=scene.environmentIntensity;scene.environment=target.texture;scene.environmentIntensity=.65
        let disposed=false
        return()=>{if(disposed)return;disposed=true;if(scene.environment===target.texture){scene.environment=previous;scene.environmentIntensity=previousIntensity}target.dispose()}
      }finally{generator.dispose();geometry.dispose();groundGeometry.dispose();material.dispose();groundMaterial.dispose()}
}
