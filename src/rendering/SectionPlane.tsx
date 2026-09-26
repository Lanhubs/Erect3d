import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Plane, Vector3, type WebGLRenderer } from 'three'

function setClippingPlanes(renderer: WebGLRenderer, height: number | null) {
  renderer.clippingPlanes = height === null ? [] : [new Plane(new Vector3(0, -1, 0), height)]
}

export function SectionPlane({ height }: { height: number | null }) {
  const { gl } = useThree()
  useEffect(() => {
    setClippingPlanes(gl, height)
    return () => setClippingPlanes(gl, null)
  }, [gl, height])
  return null
}
