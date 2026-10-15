import {ACESFilmicToneMapping,WebGLRenderer} from 'three'
import type {WebGLRendererParameters} from 'three'
type RendererDefaults=Omit<WebGLRendererParameters,'canvas'> & {canvas:unknown}
export type RendererChoice='auto'|'webgl'|'webgl2'
export function legacyRenderer(defaults:RendererDefaults) {
  const renderer=new WebGLRenderer({...defaults,canvas:defaults.canvas as HTMLCanvasElement,antialias:true,alpha:false,powerPreference:'high-performance'})
  renderer.toneMapping=ACESFilmicToneMapping;renderer.domElement.dataset.graphicsEngine='webgl'
  return renderer
}
export async function graphicsRenderer(defaults:RendererDefaults,choice:RendererChoice='auto') {
  if(choice==='webgl')return legacyRenderer(defaults)
  try {
    const {WebGPURenderer}=await import('three/webgpu')
    const renderer=new WebGPURenderer({canvas:defaults.canvas as HTMLCanvasElement,antialias:true,alpha:false,forceWebGL:choice==='webgl2'})
    await renderer.init()
    renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1
    renderer.domElement.dataset.graphicsEngine=(renderer.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend?'webgpu':'webgl2'
    return renderer as unknown as WebGLRenderer
  }catch(cause){
    // The viewport boundary mounts a fresh WebGL canvas if initialization fails.
    throw new Error('The preferred graphics renderer could not initialize.',{cause})
  }
}
