import {towerValidationSample} from '../domain/towerValidationSample'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createSampleLibrary } from '../domain/sampleLibrary'
import { basketballArenaSample } from '../domain/basketballArenaSample'
import { createArenaArchitecture } from '../domain/arenaArchitecture'
import { useProject } from '../state/project'
import { Viewer } from './Viewer'
import type { RendererChoice } from './graphicsRenderer'
import type {GraphicsSnapshot} from './GraphicsRuntime'
import './graphicsBenchmark.css'
import type {Project} from '../domain/types'
const qaModels=import.meta.glob('../../.local/stadium-reconstruction.json',{eager:true,import:'default'}) as Record<string,Project>

export default function GraphicsBenchmark() {
  const query=new URLSearchParams(window.location.search)
  const scenes = useMemo(() => {
    const arena = basketballArenaSample(), building = arena.buildings[0], ground = building.levels[0]
    building.levels = [ground]; building.roofSections = []; ground.seatingSections = []; ground.stairs = []
    ground.details = []; ground.columns = []; ground.walls = ground.walls.slice(4); ground.doors = []; ground.windows = []
    ground.walls.forEach(wall => { wall.height = 3 })
    return [...createSampleLibrary(),{id:'tower-32',title:'32-storey linked office tower',project:towerValidationSample()}, { id: 'vision-arena', title: 'Parametric civic arena', project: createArenaArchitecture(arena, ground.id) },
      ...Object.values(qaModels).map(project=>({id:'source-stadium',title:'Exact stadium PNG · backend model',project}))]
  }, [])
  const [sceneId, setSceneId] = useState(query.get('scene') || 'house'), [renderer, setRenderer] = useState<RendererChoice>(query.get('renderer')==='auto'?'auto':'webgl')
  const [optimized, setOptimized] = useState(query.get('optimized')==='1'), [roof, setRoof] = useState(true)
  const [run,setRun]=useState(-1),[results,setResults]=useState<{scene:string;variant:string;stats:GraphicsSnapshot}[]>([])
  const timing=useRef({started:0,samples:[] as GraphicsSnapshot[]})
  const cases=useMemo(()=>['house','villa','apartment','office','mall','tower-32','table-tennis','stadium','vision-arena'].flatMap(scene=>[
    {scene,renderer:'webgl' as const,optimized:false},{scene,renderer:'webgl' as const,optimized:true},{scene,renderer:'auto' as const,optimized:true}]),[])
  const selectedScene = scenes.find(scene => scene.id === sceneId) || scenes.find(scene=>scene.id==='house')!
  const project = useProject(state => state.project), selection = useProject(state => state.selection)
  const select = useProject(state => state.setSelection), activeLevel = useProject(state => state.activeLevelId)
  useEffect(() => { useProject.getState().setProject(structuredClone(selectedScene.project)) }, [selectedScene])
  useEffect(()=>{
    if(run<0 || run>=cases.length)return
    const item=cases[run];setSceneId(item.scene);setRenderer(item.renderer);setOptimized(item.optimized)
    timing.current={started:performance.now(),samples:[]}
  },[run,cases])
  const report=(stats:GraphicsSnapshot)=>{
    if(run<0 || run>=cases.length || performance.now()-timing.current.started<5000)return
    const samples=timing.current.samples;samples.push(stats)
    if(samples.length<3)return
    const average={...stats}
    for(const key of ['fps','frameMS','p95','cpuMS','calls','triangles'] as const)average[key]=samples.reduce((sum,item)=>sum+item[key],0)/samples.length
    const item=cases[run]
    setResults(previous=>[...previous,{scene:item.scene,variant:item.optimized?item.renderer==='auto'?'preferred':'batched':'baseline',stats:average}]);setRun(value=>value+1)
  }
  if (!project) return <p>Preparing benchmark…</p>
  return <main className="graphics-benchmark">
    <header><h1>Rendering benchmark · development only</h1>
      <label>Scene<select aria-label="Benchmark scene" value={sceneId} onChange={event => setSceneId(event.target.value)}>
        {scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select></label>
      <label>Renderer<select aria-label="Benchmark renderer" value={renderer} onChange={event => setRenderer(event.target.value as RendererChoice)}>
        <option value="webgl">Existing WebGL baseline</option><option value="auto">WebGPU preferred</option><option value="webgl2">Modern WebGL2 fallback</option></select></label>
      <label><input type="checkbox" checked={optimized} onChange={event => setOptimized(event.target.checked)}/> Optimized batches</label>
      <button onClick={()=>{setResults([]);setRun(0)}} disabled={run>=0 && run<cases.length}>Run scene comparison</button>
      <button onClick={()=>setRun(-1)} disabled={run<0 || run>=cases.length}>Stop benchmark</button>
      <span>{run>=0?`${Math.min(run, cases.length)} / ${cases.length} comparisons`:''}</span>
      <p>Identical scene, camera and viewport. Continuous frames during comparisons; idle previews rest. CPU measures submission time, not GPU time.</p>
    </header>
    <Viewer key={project.id} building={project.buildings[0]} activeLevelId={activeLevel || project.buildings[0].levels[0].id}
      selection={selection} select={select} roofShown={roof} setRoofShown={setRoof} benchmark={{renderer,optimized,report,continuous:run>=0 && run<cases.length}}/>
    {!!results.length && <details className="benchmark-results"><summary>Benchmark results ({results.length})</summary><output aria-label="Benchmark results">{JSON.stringify(results,null,2)}</output></details>}
  </main>
}
