import {createContext,useContext,useEffect,useMemo,type ReactNode} from 'react'
import {useThree} from '@react-three/fiber'
import type {WebGLRenderer} from 'three'
import {prepareEnvironment} from './CachedEnvironment'
import type {QualityTier} from './graphicsQuality'
const Preparation=createContext({ready:false})
const queues=new WeakMap<WebGLRenderer,Promise<void>>()
export const useGraphicsPreparation=()=>useContext(Preparation)
// A viewport has one preparation owner. Native pipelines are compiled
// asynchronously before the first building draw, avoiding synchronous driver
// compilation across thousands of meshes on that first frame.
export function GraphicsPreparation({tier,optimized,skip,children,onPrepared,onFailure}:{tier:QualityTier;optimized:boolean;skip:ReadonlySet<string>;children:ReactNode;onPrepared?:()=>void;onFailure?:()=>void}){
  const {gl,scene,camera,invalidate}=useThree()
  const state=useMemo(()=>({ready:false}),[gl,tier,optimized,skip])
  useEffect(()=>{
    let cancelled=false,release=()=>{}
    const start=async()=>{
      if(cancelled)return
      const began=performance.now();let succeeded=false;gl.domElement.dataset.preparation='environment'
      if(import.meta.env.DEV)console.info('Graphics startup: environment preparation')
      try{
        if(optimized&&!skip.has('environment'))release=await prepareEnvironment(gl,scene,tier)
        if(cancelled){release();return}
        // Commit linked-floor capture packages before collecting compile work.
        await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))
        if(cancelled)return
        gl.domElement.dataset.preparation='shaders'
        if(import.meta.env.DEV)console.info('Graphics startup: shader preparation')
        if(!skip.has('warmup'))await gl.compileAsync(scene,camera)
        succeeded=true
        if(import.meta.env.DEV)console.info('Graphics startup: scene prepared')
      }catch(error){if(!cancelled){gl.domElement.dataset.preparation='failed';onFailure?.();if(import.meta.env.DEV)console.warn('Graphics preparation failed.',error)}}
      finally{if(!cancelled&&succeeded){state.ready=true;gl.domElement.dataset.preparation='ready';gl.domElement.dataset.preparationMs=String(Math.round(performance.now()-began));onPrepared?.();invalidate()}}
    }
    const work=(queues.get(gl)||Promise.resolve()).catch(()=>{}).then(start)
    queues.set(gl,work)
    return()=>{cancelled=true;state.ready=false;release()}
  },[gl,scene,camera,tier,optimized,skip,state,invalidate,onPrepared,onFailure])
  return <Preparation.Provider value={state}>{children}</Preparation.Provider>
}
