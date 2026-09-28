import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Plane, Vector3, type WebGLRenderer } from 'three'

function setClippingPlanes(renderer: WebGLRenderer, height: number | null, vertical: number | null) {
  renderer.clippingPlanes = [
    ...(height === null ? [] : [new Plane(new Vector3(0, -1, 0), height)]),
    ...(vertical === null ? [] : [new Plane(new Vector3(-1, 0, 0), vertical)]),
  ]
}

export function SectionPlane({ height, vertical = null }: { height: number | null; vertical?: number | null }) {
  const { gl } = useThree()
  useEffect(() => {
    setClippingPlanes(gl, height, vertical)
    return () => setClippingPlanes(gl, null, null)
  }, [gl, height, vertical])
  return null
}
