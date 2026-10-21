import {useEffect,useRef,useState} from 'react'
import type {PlanPreview} from '../../domain/planPreview'
import type {DashboardProject} from './Dashboard'
export function ProjectPreview({project,load}:{project:DashboardProject;load?:(project:DashboardProject)=>Promise<PlanPreview>}){
  const host=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false),[preview,setPreview]=useState<PlanPreview|null>(null)
  useEffect(()=>{
    if(!host.current)return
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'160px'})
    observer.observe(host.current);return()=>observer.disconnect()
  },[])
  useEffect(()=>{
    let alive=true;setPreview(null)
    if(visible&&load)void load(project).then(value=>{if(alive)setPreview(value)}).catch(()=>{})
    return()=>{alive=false}
  },[visible,load,project.id,project.revision,project.modified,project.pending])
  return <div ref={host} className="project-plan-thumb">{preview?.svg?<img alt={`${project.name} · ${preview.levelName} plan`} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.svg)}`}/>:<span>{visible?'No floor-plan preview yet':'Floor-plan preview'}</span>}</div>
}
