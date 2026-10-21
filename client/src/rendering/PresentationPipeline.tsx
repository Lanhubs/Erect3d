import {useCallback,useEffect,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import type {RenderPipeline} from 'three/webgpu'
import {useGraphicsSettings} from './GraphicsRuntime'
import {useGraphicsPreparation} from './GraphicsPreparation'
// High quality gets a half-resolution contact-depth pass. Balanced uses MSAA
// and renderer tone mapping directly, with no extra scene redraws.
export function PresentationPipeline({enabled=true,onFailure}:{enabled?:boolean;onFailure?:()=>void}){
  const {gl,scene,camera,invalidate}=useThree(),{tier,optimized}=useGraphicsSettings()
  const preparation=useGraphicsPreparation()
  const pipeline=useRef<RenderPipeline|null>(null)
  const dispose=useRef(()=>{})
  const failed=useRef(false),frames=useRef(0),failure=useRef(onFailure);failure.current=onFailure
  const stop=useCallback((error:unknown)=>{if(failed.current)return;failed.current=true;dispose.current();failure.current?.();if(import.meta.env.DEV)console.warn('3D rendering stopped after a graphics failure.',error)},[])
  useEffect(()=>{
    const native=gl as unknown as {onError?:(error:unknown)=>void},previous=native.onError
    native.onError=stop;return()=>{if(native.onError===stop)native.onError=previous}
  },[gl,stop])
  useEffect(()=>{
    if(!enabled||!optimized || tier!=='high' || !(gl as unknown as {isWebGPURenderer?:boolean}).isWebGPURenderer)return
    let cancelled=false,release=()=>{}
    const prepare=async()=>{
      const [{RenderPipeline},tsl,{ao}]=await Promise.all([import('three/webgpu'),import('three/tsl'),import('three/addons/tsl/display/GTAONode.js')])
      if(cancelled)return
      const view=tsl.pass(scene,camera,{samples:0}),occlusion=ao(view.getTextureNode('depth'),null as never,camera)
      occlusion.resolutionScale=.5;occlusion.samples.value=8;occlusion.radius.value=.65;occlusion.scale.value=.55;occlusion.useTemporalFiltering=false
      const output=view.getTextureNode('output'),result=new RenderPipeline(gl as never)
      // Reconstruct normals from the shared depth attachment; no second geometry
      // pass or unused MRT attachments are allocated for this one effect.
      result.outputNode=output.mul(tsl.mix(1,occlusion.getTextureNode(),.35))
      pipeline.current=result;invalidate()
      let released=false
      release=()=>{if(released)return;released=true;if(pipeline.current===result)pipeline.current=null;result.dispose();view.dispose();occlusion.dispose()}
      dispose.current=release
    }
    void prepare().catch(error=>{if(!cancelled)stop(error)})
    return()=>{cancelled=true;release();dispose.current=()=>{}}
  },[gl,scene,camera,tier,optimized,invalidate,enabled,stop])
  useFrame(()=>{
    if(!preparation.ready||failed.current)return
    try{if(pipeline.current)pipeline.current.render();else gl.render(scene,camera)
      frames.current++
      if(import.meta.env.DEV)gl.domElement.dataset.renderedFrames=String(frames.current)
      // Native shadow/presentation attachments settle on the first submitted
      // frame. Flush those initial frames before resting; otherwise a demand
      // viewport can stay blank until the user moves the camera.
      if(frames.current<3)invalidate()
    }catch(error){stop(error)}
  },1)
  return null
}
