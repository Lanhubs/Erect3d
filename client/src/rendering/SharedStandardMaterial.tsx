import { useLayoutEffect } from 'react'
import type { MeshStandardMaterialParameters } from 'three'
import { useRenderResources } from './RenderResources'

type SurfaceProps = Pick<
  MeshStandardMaterialParameters,
  | 'color'
  | 'map'
  | 'roughness'
  | 'metalness'
  | 'side'
  | 'polygonOffset'
  | 'polygonOffsetFactor'
  | 'polygonOffsetUnits'
> & { attach?: string }
export function SharedStandardMaterial({ attach = 'material', ...parameters }: SurfaceProps) {
  const resources = useRenderResources(),
    material = resources.standard(parameters)
  useLayoutEffect(() => {
    resources.retain(material)
    return () => resources.release(material)
  }, [resources, material])
  // A primitive borrows the pooled material; the parent still owns its geometry.
  return <primitive object={material} attach={attach} />
}
