import { ACESFilmicToneMapping, WebGLRenderer } from 'three'
import type { WebGLRendererParameters } from 'three'
type RendererDefaults = Omit<WebGLRendererParameters, 'canvas'> & { canvas: unknown }
export type RendererChoice = 'auto' | 'webgl' | 'webgl2'
export function legacyRenderer(defaults: RendererDefaults) {
  const renderer = new WebGLRenderer({
    ...defaults,
    canvas: defaults.canvas as HTMLCanvasElement,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.domElement.dataset.graphicsEngine = 'webgl'
  if (import.meta.env.DEV) renderer.domElement.dataset.rendererInstance = crypto.randomUUID()
  return renderer
}
export async function graphicsRenderer(defaults: RendererDefaults, choice: RendererChoice = 'auto') {
  if (choice === 'webgl') return legacyRenderer(defaults)
  try {
    const { WebGPURenderer } = await import('three/webgpu')
    const renderer = new WebGPURenderer({
      canvas: defaults.canvas as HTMLCanvasElement,
      antialias: true,
      alpha: false,
      forceWebGL: choice === 'webgl2',
    })
    if (import.meta.env.DEV) console.info('Graphics startup: renderer initialization')
    try {
      await renderer.init()
    } catch (error) {
      renderer.dispose()
      throw error
    }
    if (import.meta.env.DEV) console.info('Graphics startup: renderer initialized')
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    renderer.domElement.dataset.graphicsEngine = (
      renderer.backend as unknown as { isWebGPUBackend?: boolean }
    ).isWebGPUBackend
      ? 'webgpu'
      : 'webgl2'
    if (import.meta.env.DEV) renderer.domElement.dataset.rendererInstance = crypto.randomUUID()
    return renderer as unknown as WebGLRenderer
  } catch (cause) {
    // Recovery choices mount a fresh canvas; a context cannot change backend.
    throw new Error('The preferred graphics renderer could not initialize.', { cause })
  }
}
