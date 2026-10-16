import {useEffect,useLayoutEffect,useState,type RefObject} from 'react'
import {useThree} from '@react-three/fiber'
const eventName='erect3d:scene-issue'
type Issue={id:string;message:string}
export function SceneIssue({id,message}:{id:string;message:string}){
  const canvas=useThree(s=>s.gl.domElement)
  useEffect(()=>{
    const report=(message:string)=>canvas.dispatchEvent(new CustomEvent<Issue>(eventName,{bubbles:true,detail:{id,message}}))
    report(message);return()=>{report('')}
  },[canvas,id,message])
  return null
}
export function useSceneIssues(host:RefObject<HTMLElement|null>){
  const [issues,setIssues]=useState<Record<string,string>>({})
  useLayoutEffect(()=>{
    const element=host.current;if(!element)return
    const report=(event:Event)=>{const {id,message}=(event as CustomEvent<Issue>).detail;setIssues(previous=>{
      const next={...previous};if(message)next[id]=message;else delete next[id];return next
    })}
    element.addEventListener(eventName,report);return()=>element.removeEventListener(eventName,report)
  },[host])
  return Object.values(issues).join(' · ')
}
