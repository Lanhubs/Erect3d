import {useEffect,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import type {RenderPipeline} from 'three/webgpu'
import {useGraphicsSettings} from './GraphicsRuntime'
// High quality gets a half-resolution contact-depth pass. Balanced uses MSAA
// and renderer tone mapping directly, with no extra scene redraws.
export function PresentationPipeline(){
  const {gl,scene,camera,invalidate}=useThree(),{tier,optimized}=useGraphicsSettings()
  const pipeline=useRef<RenderPipeline|null>(null)
  useEffect(()=>{
    if(!optimized || tier!=='high' || !(gl as unknown as {isWebGPURenderer?:boolean}).isWebGPURenderer)return
    let cancelled=false,release=()=>{}
    const native=gl as unknown as {onError?:(message:string)=>void},previousError=native.onError
    const recover=(message:string)=>{pipeline.current=null;release();invalidate();previousError?.(message)}
    native.onError=recover
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
      release=()=>{if(pipeline.current===result)pipeline.current=null;result.dispose();view.dispose();occlusion.dispose()}
    }
    void prepare().catch(()=>{pipeline.current=null;invalidate()})
    return()=>{cancelled=true;if(native.onError===recover)native.onError=previousError;release()}
  },[gl,scene,camera,tier,optimized,invalidate])
  useFrame(()=>{
    if(pipeline.current){try{pipeline.current.render()}catch{pipeline.current=null;gl.render(scene,camera)}}
    else gl.render(scene,camera)
  },1)
  return null
}
