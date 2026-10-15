import {useRef,useState} from 'react'
import {api} from './api'
import {useProject} from '../state/project'
import type {Building} from '../domain/types'
export function DesignReference({projectId,building,disabled,ensureSynced}:{projectId:string;building:Building;disabled:boolean;ensureSynced:()=>Promise<void>}){
  const input=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),edit=useProject(state=>state.editProject)
  const upload=async(file:File)=>{
    setBusy(true);setError('')
    try{
      const mime=file.type || (/\.png$/i.test(file.name)?'image/png':/\.webp$/i.test(file.name)?'image/webp':'image/jpeg')
      if(!['image/png','image/jpeg','image/webp'].includes(mime))throw new Error('Choose a PNG, JPEG or WebP reference image.')
      await ensureSynced()
      const query=new URLSearchParams({name:file.name,kind:'source',mime})
      const uploaded=await api.request<{assetId:string}>(`/projects/${projectId}/assets/optimized-upload?${query}`,'POST',new Blob([file],{type:mime}),crypto.randomUUID())
      edit(project=>{project.buildings.find(item=>item.id===building.id)!.designReference={assetId:uploaded.assetId,name:file.name.slice(0,200)};return project})
      await ensureSynced()
    }catch(cause){setError((cause as Error).message)}finally{setBusy(false);if(input.current)input.current.value=''}
  }
  return <div className="design-reference">
    <p>Design reference · optional. Guides the architecture and finishes while the floor plan defines measured geometry.</p>
    {building.designReference && <p>{building.designReference.name}</p>}
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file)}}/>
    <button disabled={disabled || busy} onClick={()=>input.current?.click()}>{busy?'Uploading reference…':building.designReference?'Replace reference':'Add design reference'}</button>
    {building.designReference && <button disabled={disabled || busy} onClick={()=>edit(project=>{delete project.buildings.find(item=>item.id===building.id)!.designReference;return project})}>Remove reference</button>}
    {error && <p role="alert">{error}</p>}
  </div>
}
