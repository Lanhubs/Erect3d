import {towerValidationSample} from '../domain/towerValidationSample'
import {buildingValidationSamples} from '../domain/buildingValidationSamples'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createSampleLibrary } from '../domain/sampleLibrary'
import { useProject } from '../state/project'
import { Viewer } from './Viewer'
import type { RendererChoice } from './graphicsRenderer'
import type {GraphicsSnapshot} from './GraphicsRuntime'
import './graphicsBenchmark.css'
import type {Project} from '../domain/types'
import {furnitureValidationScene} from '../furniture/validationScene'
const qaModels=(import.meta.env.DEV?import.meta.glob(['../../.local/five-storey-reconstruction.json','../../.local/png-analysis-verification.json'],{eager:true,import:'default'}):{}) as Record<string,Project>
const comparisonScenes=['house','villa','apartment','office','mall','tower-32','tower-256']

export default function GraphicsBenchmark() {
  const query=new URLSearchParams(window.location.search)
  const scenes = useMemo(() => {
    return [...createSampleLibrary(),...buildingValidationSamples(),{id:'tower-32',title:'32-storey linked office tower',project:towerValidationSample()},
      {id:'tower-256',title:'256-storey linked office stress fixture',project:towerValidationSample(256)},
      {id:'furniture-study',title:'Authored furniture studio · geometry check',project:furnitureValidationScene()},
      ...Object.entries(qaModels).map(([path,project])=>({id:path.includes('png-analysis')?'source-mansion':'source-office',title:path.includes('png-analysis')?'Original mansion PNG · reconstruction check':'Original office PDF · ground-floor reconstruction',project}))]
  }, [])
  const [sceneId, setSceneId] = useState(query.get('scene') || 'house'), [renderer, setRenderer] = useState<RendererChoice>(query.get('renderer')==='auto'?'auto':'webgl')
  const [optimized, setOptimized] = useState(query.get('optimized')==='1'), [roof, setRoof] = useState(true)
  const [tracing,setTracing]=useState(query.get('trace')==='orbit'),[traceSamples,setTraceSamples]=useState<GraphicsSnapshot[]>([])
  const traceStart=useRef(performance.now())
  const [run,setRun]=useState(-1),[results,setResults]=useState<{scene:string;variant:string;stats:GraphicsSnapshot|null;status:string}[]>([])
  const timing=useRef({started:0,samples:[] as GraphicsSnapshot[],finished:false})
  const [caseScenes,setCaseScenes]=useState(comparisonScenes)
  const cases=useMemo(()=>caseScenes.flatMap(scene=>[
    {scene,renderer:'webgl' as const,optimized:false},{scene,renderer:'webgl' as const,optimized:true},{scene,renderer:'auto' as const,optimized:true}]),[caseScenes])
  const selectedScene = scenes.find(scene => scene.id === sceneId) || scenes.find(scene=>scene.id==='house')!
  const project = useProject(state => state.project), selection = useProject(state => state.selection)
  const select = useProject(state => state.setSelection), activeLevel = useProject(state => state.activeLevelId)
  useEffect(() => {
    useProject.getState().setProject(structuredClone(selectedScene.project))
  }, [selectedScene])
  useEffect(()=>{
    if(run<0 || run>=cases.length)return
    const item=cases[run];setSceneId(item.scene);setRenderer(item.renderer);setOptimized(item.optimized)
    timing.current={started:performance.now(),samples:[],finished:false}
    const timer=setTimeout(()=>{
      if(timing.current.finished)return
      timing.current.finished=true
      setResults(previous=>[...previous,{scene:item.scene,variant:item.optimized?item.renderer==='auto'?'preferred':'batched':'baseline',stats:null,status:'insufficient-timing-samples'}])
      setRun(value=>value===run?value+1:value)
    },45000)
    return()=>clearTimeout(timer)
  },[run,cases])
  const report=(stats:GraphicsSnapshot)=>{
    if(tracing&&performance.now()-traceStart.current>5000){setTraceSamples(samples=>[...samples,stats]);if(traceSamples.length>=5)setTracing(false)}
    if(run<0 || run>=cases.length || timing.current.finished || performance.now()-timing.current.started<5000)return
    const samples=timing.current.samples;samples.push(stats)
    if(samples.length<3)return
    timing.current.finished=true
    const average={...stats}
    for(const key of ['fps','frameMS','p95','cpuMS','calls','triangles'] as const)average[key]=samples.reduce((sum,item)=>sum+item[key],0)/samples.length
    const item=cases[run]
    setResults(previous=>[...previous,{scene:item.scene,variant:item.optimized?item.renderer==='auto'?'preferred':'batched':'baseline',stats:average,status:'measured'}]);setRun(value=>value+1)
  }
  if (!project) return <p>Preparing benchmark…</p>
  return <main className="graphics-benchmark">
    <header><h1>Rendering benchmark · development only</h1>
      <label>Scene<select aria-label="Benchmark scene" value={sceneId} onChange={event => setSceneId(event.target.value)}>
        {scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select></label>
      <label>Renderer<select aria-label="Benchmark renderer" value={renderer} onChange={event => setRenderer(event.target.value as RendererChoice)}>
        <option value="webgl">Existing WebGL baseline</option><option value="auto">WebGPU preferred</option><option value="webgl2">Modern WebGL2 fallback</option></select></label>
      <label><input type="checkbox" checked={optimized} onChange={event => setOptimized(event.target.checked)}/> Optimized batches</label>
      {project.buildings[0].levels.length>1&&<label>Level<select aria-label="Benchmark level" value={activeLevel||project.buildings[0].levels[0].id}
        onChange={event=>useProject.getState().setActiveLevel(event.target.value)}>{project.buildings[0].levels.map(level=><option key={level.id} value={level.id}>{level.name}</option>)}</select></label>}
      <button onClick={()=>{setCaseScenes(comparisonScenes);setResults([]);setRun(0)}} disabled={run>=0 && run<cases.length}>Run scene comparison</button>
      <button onClick={()=>{setCaseScenes([sceneId]);setResults([]);setRun(0)}} disabled={run>=0&&run<cases.length}>Compare current scene</button>
      <button onClick={()=>setRun(-1)} disabled={run<0 || run>=cases.length}>Stop benchmark</button>
      <button onClick={()=>{traceStart.current=performance.now();setTraceSamples([]);setTracing(value=>!value)}}>{tracing?'Stop navigation trace':'Record navigation trace'}</button>
      <span>{run>=0?`${Math.min(run, cases.length)} / ${cases.length} comparisons`:''}</span>
      <p>Identical scene, camera and viewport. Continuous frames during comparisons; idle previews rest. CPU measures submission time, not GPU time.</p>
    </header>
    <Viewer key={project.id} building={project.buildings[0]} activeLevelId={activeLevel || project.buildings[0].levels[0].id}
      selection={selection} select={select} roofShown={roof} setRoofShown={setRoof} benchmark={{renderer,optimized,report,minimal:query.get('minimal')==='1',probe:tracing,continuous:tracing||run>=0 && run<cases.length}}/>
    {!!traceSamples.length&&<details open className="benchmark-results"><summary>Fixed-quality navigation trace</summary><output aria-label="Navigation trace">{JSON.stringify(traceSamples)}</output></details>}
    {!!results.length && <details className="benchmark-results"><summary>Benchmark results ({results.length})</summary><output aria-label="Benchmark results">{JSON.stringify(results,null,2)}</output></details>}
  </main>
}
