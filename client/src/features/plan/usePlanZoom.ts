import { useEffect, useRef, type RefObject, type Dispatch, type SetStateAction } from 'react'
import type { Level, SiteFence } from '../../domain/types'
import { zoomEvent, type ZoomDetail } from '../../app/useWorkspaceZoom'
import { fitBounds, type PlanBox, type PlanSourceRect } from './planBounds'

export function usePlanZoom(
  svg: RefObject<SVGSVGElement | null>,
  level: Level,
  source: PlanSourceRect | undefined,
  setBox: Dispatch<SetStateAction<PlanBox>>,
  fence?: SiteFence,
) {
  const fitted = useRef('')
  useEffect(() => {
    const key = `${level.id}:${source?.url}:${source?.x}:${source?.z}:${source?.width}:${source?.height}:${fence?.id}:${fence?.enabled}`
    if (key !== fitted.current) {
      fitted.current = key
      setBox(fitBounds(level, source, fence))
    }
  }, [level, source, setBox, fence])
  useEffect(() => {
    const node = svg.current,
      host = node?.parentElement
    if (!node || !host) return
    const zoom = (event: Event) => {
      const { factor, reset, clientX, clientY } = (event as CustomEvent<ZoomDetail>).detail
      if (reset) {
        setBox(fitBounds(level, source, fence))
        return
      }
      const bounds = node.getBoundingClientRect()
      const point = node.createSVGPoint()
      point.x =
        clientX !== undefined && clientX >= bounds.left && clientX <= bounds.right
          ? clientX
          : bounds.left + bounds.width / 2
      point.y =
        clientY !== undefined && clientY >= bounds.top && clientY <= bounds.bottom
          ? clientY
          : bounds.top + bounds.height / 2
      const anchor = point.matrixTransform(node.getScreenCTM()!.inverse())
      setBox((current) => {
        const scale = Math.max(0.25 / current.width, Math.min(2000 / current.width, factor || 1))
        return {
          x: anchor.x + (current.x - anchor.x) * scale,
          z: anchor.y + (current.z - anchor.y) * scale,
          width: current.width * scale,
          height: current.height * scale,
        }
      })
    }
    host.addEventListener(zoomEvent, zoom)
    return () => host.removeEventListener(zoomEvent, zoom)
  }, [svg, level, source, setBox, fence])
}
