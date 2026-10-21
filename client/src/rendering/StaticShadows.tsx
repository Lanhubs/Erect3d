import {useLayoutEffect,useRef,type RefObject} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import type {DirectionalLight} from 'three'
import {useRenderResources} from './RenderResources'
// One fitted light retains exactly the same map/filter/bias. Only caster or
// lighting changes invalidate it; orbiting the inspection camera does not.
export function StaticShadows({light,epoch}:{light:RefObject<DirectionalLight|null>;epoch:readonly unknown[]}){
  const resources=useRenderResources(),gl=useThree(state=>state.gl),seen=useRef(-1)
  const cached=!(import.meta.env.DEV&&new URLSearchParams(location.search).get('shadowCache')==='0')
  useLayoutEffect(()=>{resources.shadowEpoch++},epoch)
  useFrame(()=>{
    if(!light.current)return
    light.current.shadow.autoUpdate=!cached
    if(!cached||seen.current!==resources.shadowEpoch){
      seen.current=resources.shadowEpoch;light.current.shadow.needsUpdate=true
      if('autoUpdate' in gl.shadowMap){gl.shadowMap.autoUpdate=!cached;gl.shadowMap.needsUpdate=true}
      if(import.meta.env.DEV)gl.domElement.dataset.shadowInvalidations=String(Number(gl.domElement.dataset.shadowInvalidations||0)+1)
    }
  },-.5)
  return null
}
