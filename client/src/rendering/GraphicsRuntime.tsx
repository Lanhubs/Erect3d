import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { InstancedMesh, Mesh } from 'three'
import { nextResolution, qualityProfiles, type QualityMode, type QualityTier } from './graphicsQuality'
import {RenderResourceScope} from './RenderResources'
import {CachedEnvironment} from './CachedEnvironment'
import {PresentationPipeline} from './PresentationPipeline'
import {ShaderWarmup} from './ShaderWarmup'

export const GraphicsSettings = createContext({ tier: 'balanced' as QualityTier, optimized: true })
export const useGraphicsSettings = () => useContext(GraphicsSettings)
export type GraphicsSnapshot = { backend: string; fps: number; frameMS: number; p95: number; cpuMS: number;
  dpr: number; calls: number; triangles: number; instances: number; objects: number; textures: number;
  geometries: number; targets: number | null; memoryMB: number | null; tier: QualityTier;drawingWidth?:number;drawingHeight?:number }
type ExtraInfo = { render: { calls: number; drawCalls?: number; triangles: number }; memory: {
  geometries: number; textures: number; renderTargets?: number; total?: number } }
export function GraphicsRuntime({ mode, optimized = true, report,onResolution,fixedDpr, children }: {
  mode: QualityMode; optimized?: boolean; report?: (snapshot: GraphicsSnapshot) => void;onResolution?:(dpr:number)=>void;fixedDpr?:number; children: ReactNode }) {
  const { gl, scene, setDpr, invalidate } = useThree()
  const [tier, setTier] = useState<QualityTier>(mode === 'auto' ? 'balanced' : mode)
  const sample = useRef({ frames: [] as number[], started: 0, evaluated: 0, adapted: 0, cpu: 0, submissions: 0 })
  const latest = useRef(report); latest.current = report
  const resolution=useRef(onResolution);resolution.current=onResolution
  const applyDpr=(value:number)=>{setDpr(value);resolution.current?.(value)}
  const drawStats=useRef({calls:0,triangles:0})
  const qualityChange=useRef(0)
  useEffect(() => {
    const target = mode === 'auto' ? 'balanced' : mode
    setTier(target);const value=fixedDpr??(target==='high'?2:Math.min(window.devicePixelRatio || 1, qualityProfiles[target].maxDpr));setDpr(value);resolution.current?.(value)
    qualityChange.current=performance.now()
    sample.current = { frames: [], started: performance.now(), evaluated: 0, adapted: 0, cpu: 0, submissions: 0 }
    invalidate()
  }, [mode, gl, setDpr, invalidate,fixedDpr])
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const original = gl.render
    gl.render = function (...args) {
      const start = performance.now()
      try { return original.apply(this, args) } finally {
        sample.current.cpu += performance.now() - start; sample.current.submissions++
        const info=gl.info as unknown as ExtraInfo
        drawStats.current={calls:info.render.drawCalls ?? info.render.calls,triangles:info.render.triangles}
      }
    }
    return () => { gl.render = original }
  }, [gl])
  useFrame((_, delta) => {
    const now = performance.now(), state = sample.current
    // Idle gaps and background-tab suspension are not rendering pressure.
    if (document.hidden || delta > .15) { state.frames = []; state.cpu=0;state.submissions=0;state.evaluated = now; return }
    state.frames.push(delta * 1000)
    if (now - state.evaluated < 2000 || state.frames.length < 45) return
    const sorted = state.frames.toSorted((a, b) => a - b)
    const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    const info = gl.info as unknown as ExtraInfo, memory = info.memory.total
    if (optimized && fixedDpr===undefined && now - state.started > 5000 && now - state.adapted > 4000) {
      const dpr = gl.getPixelRatio(), next = nextResolution(dpr, mean, (memory || 0) / 1048576, tier)
      if (Math.abs(next - dpr) > .025) applyDpr(tier==='high'?next:Math.min(next, window.devicePixelRatio || 1))
      if (mode === 'auto' && now-qualityChange.current>12000) {
        let target=tier
        if (mean > 29 || (memory || 0)/1048576>qualityProfiles[tier].memoryMB)target=tier==='high'?'balanced':'performance'
        else if(mean<18 && sorted[Math.floor(sorted.length*.95)]<23)target=tier==='performance'?'balanced':memory!==undefined && memory/1048576<180?'high':tier
        if(target!==tier){setTier(target);qualityChange.current=now}
      }
      state.adapted = now
    }
    if (import.meta.env.DEV && latest.current) {
      let instances = 0, objects = 0
      scene.traverseVisible(object => { if (object instanceof Mesh) objects++; if (object instanceof InstancedMesh) instances += object.count })
      latest.current({ backend: gl.domElement.dataset.graphicsEngine || 'unknown', fps: 1000 / mean,
        frameMS: mean, p95: sorted[Math.floor(sorted.length * .95)], cpuMS: state.cpu / Math.max(1, state.frames.length),
        dpr: gl.getPixelRatio(), calls: drawStats.current.calls, triangles: drawStats.current.triangles,
        instances, objects, textures: info.memory.textures, geometries: info.memory.geometries,
        targets: info.memory.renderTargets ?? null, memoryMB: memory === undefined ? null : memory / 1048576, tier,drawingWidth:gl.domElement.width,drawingHeight:gl.domElement.height })
    }
    state.frames = []; state.evaluated = now; state.cpu = 0; state.submissions = 0
  }, -100)
  return <GraphicsSettings.Provider value={{ tier, optimized }}><RenderResourceScope><CachedEnvironment/><PresentationPipeline/>{children}<ShaderWarmup/></RenderResourceScope></GraphicsSettings.Provider>
}
