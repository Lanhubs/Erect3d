import {useCallback,useEffect,useRef,useState} from 'react'
import {api,capabilities} from './api'
import {getTask,putTask} from './cache'
import {subscribeAssistant} from './assistantEvents'
import {subscribeAnalysis} from './analysisEvents'
import {useProject} from '../state/project'
import type {CloudSession} from './useCloudProject'
import type {AssistantRun,AssistantScope,ChatCache,Thread} from './assistantTypes'
import {pendingRun} from './assistantTypes'
import {applyAssistantProposal,finishAssistantApply} from './assistantApply'
export function useAssistant(userId:string,projectId:string,session:CloudSession,open:boolean){
  const key=`${userId}/assistant/${projectId}`,path=`/projects/${projectId}/assistant`
  const [thread,setThread]=useState<Thread>({messages:[],run:null,nextCursor:null}),[draft,setDraft]=useState(''),[choice,setChoice]=useState<AssistantScope['mode']|null>(null),[attach,setAttach]=useState(false)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[enabled,setEnabled]=useState<boolean|null>(null),[online,setOnline]=useState(navigator.onLine),[loaded,setLoaded]=useState(false)
  const latest=useRef({thread,session});latest.current={thread,session}
  const cached=useRef({key,loaded,value:{...thread,draft,choice,attach}});cached.current={key,loaded,value:{...thread,draft,choice,attach}}
  useEffect(()=>()=>{const last=cached.current;if(last.loaded)void putTask(last.key,last.value).catch(()=>{})},[key])
  const project=useProject(s=>s.project),activeId=useProject(s=>s.activeLevelId),selection=useProject(s=>s.selection),readOnly=useProject(s=>s.readOnly),dirty=useProject(s=>s.dirty)
  const building=project?.buildings.find(b=>b.levels.some(l=>l.id===activeId))||project?.buildings[0],level=building?.levels.find(l=>l.id===activeId)||building?.levels[0]
  const referenceName=project?.sources.find(source=>source.id===level?.sourceId)?.name||'this floor’s imported plan'
  const scope:AssistantScope|undefined=building&&level?{mode:choice||((selection?.id)?'selection':'level'),buildingId:building.id,levelId:level.id,
    ...((choice==='selection'||!choice&&selection)?{entityId:selection?.id,floorIndex:selection?.floorIndex}:{})}:undefined
  const stale=thread.run?.status==='ready'&&(thread.run.base_revision!==session.record?.base.revision||dirty||!!session.record?.pending||!!session.record?.conflict||session.state==='pending')
  const refresh=useCallback(async()=>{
    const value=await api.request<Thread>(`${path}/thread`)
    setThread(value)
    if(value.run?.status==='applied')await finishAssistantApply(latest.current.session,key,value.run)
    return value
  },[key,path])
  useEffect(()=>{
    let alive=true
    getTask<ChatCache>(key).then(cache=>{if(alive){if(cache){setThread(cache);setDraft(cache.draft);setChoice(cache.choice);setAttach(cache.attach)}setLoaded(true)}}).catch(()=>{if(alive)setLoaded(true)})
    capabilities().then(c=>{if(alive)setEnabled(!!c.assistant)}).catch(()=>{if(alive)setEnabled(null)})
    return()=>{alive=false}
  },[key])
  useEffect(()=>{
    if(!loaded)return
    const timer=setTimeout(()=>void putTask(key,{...thread,draft,choice,attach}).catch(()=>{}),200)
    return()=>clearTimeout(timer)
  },[key,loaded,thread,draft,choice,attach])
  useEffect(()=>{if(open&&loaded&&online)void refresh().catch(e=>setError(e.message))},[open,loaded,online,refresh])
  useEffect(()=>{
    const connected=()=>{setOnline(navigator.onLine);if(navigator.onLine)void refresh().catch(()=>{})}
    window.addEventListener('online',connected);window.addEventListener('offline',connected)
    const stop=subscribeAssistant(projectId,event=>{
      if(latest.current.thread.run?.id!==event.runId)return
      setThread(before=>({...before,run:before.run?{...before.run,progress:event.progress,status:event.status||before.run.status}:null}))
      if(event.status&&!['queued','running'].includes(event.status))void refresh().catch(e=>setError(e.message))
    })
    const reconnect=subscribeAnalysis(projectId,type=>{if(type==='connection.open')void refresh().catch(()=>{})})
    return()=>{stop();reconnect();window.removeEventListener('online',connected);window.removeEventListener('offline',connected)}
  },[projectId,refresh])
  const action=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const send=()=>action(async()=>{
    if(!scope||!draft.trim()||readOnly||!online)throw new Error('Connect and choose an editable part of the building first.')
    if(scope.mode==='selection'&&!scope.entityId)throw new Error('Select an element or choose This floor.')
    const engine=session.engine;if(!engine)throw new Error('This project is read only.')
    await engine.sync();if(engine.state!=='saved')throw new Error('Resolve pending edits before sending this request.')
    const previous=thread.run?.status==='ready'&&thread.run.base_revision===engine.record.base.revision&&JSON.stringify(thread.run.scope)===JSON.stringify(scope)?thread.run.id:undefined
    const input={message:draft.trim(),scope,baseRevision:engine.record.base.revision,planSourceIds:attach&&level?.sourceId?[level.sourceId]:[],previousRunId:previous}
    const old=await getTask<{input:unknown;id:string}>(`${key}/send`),id=JSON.stringify(old?.input)===JSON.stringify(input)?old!.id:crypto.randomUUID()
    await putTask(`${key}/send`,{input,id})
    try{
      const result=await api.request<{runId:string}>(`${path}/messages`,'POST',input,id)
      const run=await api.request<AssistantRun>(`${path}/runs/${result.runId}`);setThread(before=>({...before,run}));setDraft('');await refresh()
    }catch(e){await refresh().catch(()=>{});throw e}
  })
  const cancel=()=>action(async()=>{if(thread.run){await api.request(`${path}/runs/${thread.run.id}/cancel`,'POST');await refresh()}})
  const apply=()=>action(async()=>{if(thread.run){await applyAssistantProposal(session,key,projectId,thread.run);await refresh()}})
  const older=()=>action(async()=>{
    if(!thread.nextCursor)return
    const previous=await api.request<Thread>(`${path}/thread?cursor=${thread.nextCursor}`)
    setThread(before=>({...before,messages:[...previous.messages,...before.messages.filter(m=>!previous.messages.some(p=>p.id===m.id))],nextCursor:previous.nextCursor}))
  })
  return {thread,draft,setDraft,scope,chooseScope:setChoice,attach,setAttach,level,building,referenceName,error,busy,enabled,online,readOnly,stale,
    pending:pendingRun(thread.run),send,cancel,apply,refresh:()=>action(async()=>{await refresh()}),older}
}
