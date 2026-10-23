import { useEffect, useMemo, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { ClippingGroup } from 'three/webgpu'
import { Plane, Vector3 } from 'three'
export function ModelClipGroup({
  height,
  vertical,
  children,
}: {
  height: number | null
  vertical: number | null
  children: ReactNode
}) {
  const gl = useThree((state) => state.gl),
    invalidate = useThree((state) => state.invalidate),
    native = Boolean((gl as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer)
  const group = useMemo(() => new ClippingGroup(), [])
  useEffect(() => {
    group.clippingPlanes = [
      ...(height === null ? [] : [new Plane(new Vector3(0, -1, 0), height)]),
      ...(vertical === null ? [] : [new Plane(new Vector3(-1, 0, 0), vertical)]),
    ]
    invalidate()
  }, [group, height, vertical, invalidate])
  return native ? <primitive object={group}>{children}</primitive> : <>{children}</>
}
