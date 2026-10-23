import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
export function ShaderWarmup() {
  const { gl, scene, camera, invalidate } = useThree()
  useEffect(() => {
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      void gl
        .compileAsync(scene, camera)
        .then(() => {
          if (!cancelled) invalidate()
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [gl, scene, camera, invalidate])
  return null
}
