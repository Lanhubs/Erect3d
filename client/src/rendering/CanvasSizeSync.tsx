import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
export function CanvasSizeSync() {
  const { gl, get, setSize, invalidate } = useThree()
  useLayoutEffect(() => {
    const host = gl.domElement.closest('.canvas-wrap')
    if (!host) return
    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (width < 1 || height < 1) return
      gl.domElement.dataset.sizeSync = `${Math.round(width)}x${Math.round(height)}`
      // R3F owns the drawing buffer and camera aspect. A second gl.setSize()
      // clears an already drawn demand frame, leaving Split blank until navigation.
      const current = get().size
      if (Math.abs(current.width - width) > 0.5 || Math.abs(current.height - height) > 0.5)
        setSize(width, height)
      invalidate()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    return () => observer.disconnect()
  }, [gl, get, setSize, invalidate])
  return null
}
