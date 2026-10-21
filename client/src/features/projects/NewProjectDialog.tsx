import {useRef,useState} from 'react'
import {useOverlay} from '../../app/useOverlay'
import type {Project} from '../../domain/types'
export function NewProjectDialog({close,create,busy,blocked,error}:{close:()=>void;create:(name:string,sample:boolean,building:string,units:Project['units'])=>void;busy?:boolean;blocked?:boolean;error?:string}){
  const [name,setName]=useState(''),[building,setBuilding]=useState(''),[units,setUnits]=useState<Project['units']>('m')
  const ref=useRef<HTMLDivElement>(null);useOverlay(ref,true,close)
  return <div className="project-dialog-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)close()}}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="new-project-title" className="project-dialog">
      <header><h2 id="new-project-title">New project</h2><button aria-label="Close new project" onClick={close}>×</button></header>
      <form onSubmit={event=>{event.preventDefault();if(name.trim()&&!busy&&!blocked)create(name.trim(),false,building,units)}}>
        <label>Project name<input autoFocus aria-label="Project name" required value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>Building name<input aria-label="Building name" placeholder="Optional" value={building} onChange={e=>setBuilding(e.target.value)}/></label>
        <label>Display units<select aria-label="Display units" value={units} onChange={e=>setUnits(e.target.value as Project['units'])}>
          <option value="m">metres</option><option value="cm">centimetres</option><option value="mm">millimetres</option></select></label>
        {error&&<p role="alert">{error}</p>}
        {blocked&&<p role="status">Reconnect to create a project. You can keep editing opened projects offline.</p>}
        <footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={!name.trim()||busy||blocked}>{busy?'Creating…':'Create project'}</button></footer>
      </form>
    </div>
  </div>
}
