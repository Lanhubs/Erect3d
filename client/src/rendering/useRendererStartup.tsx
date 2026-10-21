import {useCallback,useEffect,useMemo,useState} from 'react'
import type {WebGLRenderer} from 'three'
import {graphicsRenderer,type RendererChoice} from './graphicsRenderer'
import {useRenderPreference} from '../state/renderPreference'
export function useRendererStartup(choice:RendererChoice){
  const [attempt,retry]=useState(0),[slow,setSlow]=useState(false),[failed,setFailed]=useState(false)
  const owner=useMemo(()=>({cancelled:false,ready:false,renderer:null as WebGLRenderer|null}),[choice,attempt])
  useEffect(()=>{
    owner.cancelled=false;setSlow(false);setFailed(false)
    const timer=setTimeout(()=>{if(!owner.ready)setSlow(true)},15000)
    // R3F owns an adopted renderer. Only an initialization that finishes after
    // cancellation is ours to dispose; disposing an adopted context here breaks
    // Strict Mode / hot refresh while the existing Canvas is still mounted.
    return()=>{clearTimeout(timer);owner.cancelled=true}
  },[owner])
  const factory=useCallback(async(defaults:Parameters<typeof graphicsRenderer>[0])=>{
    const renderer=await graphicsRenderer(defaults,choice)
    if(owner.cancelled){renderer.dispose();throw new Error('Renderer initialization was cancelled.')}
    owner.renderer=renderer;return renderer
  },[choice,owner])
  const prepared=useCallback(()=>{owner.ready=true;setSlow(false)},[owner])
  const failure=useCallback(()=>{if(!owner.cancelled){setFailed(true);setSlow(false)}},[owner])
  const recover=<div className="renderer-recovery" role="alert"><p>The 3D renderer could not start. Your model is preserved.</p><button onClick={()=>retry(n=>n+1)}>Retry 3D</button><button onClick={()=>useRenderPreference.getState().setRenderer('webgl')}>Use compatibility renderer</button></div>
  const waiting=failed?recover:slow?<div className="renderer-recovery" role="status"><p>Graphics initialization is taking longer than expected.</p><button onClick={()=>retry(n=>n+1)}>Retry 3D</button><button onClick={()=>useRenderPreference.getState().setRenderer('webgl')}>Use compatibility renderer</button></div>:null
  return {factory,key:`${choice}:${attempt}`,recover,waiting,prepared,failure,failed}
}
