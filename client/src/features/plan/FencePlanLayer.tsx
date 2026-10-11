import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Point, Selection, SiteFence } from '../../domain/types'
import { updateFenceBoundary } from '../../geometry/site'
import { useProject } from '../../state/project'
import { pointerPlanPoint } from './planBounds'

export function FencePlanLayer({ svg, fence, selected, select, enabled }: {
  svg: RefObject<SVGSVGElement | null>; fence: SiteFence; selected: boolean; select: (selection: Selection) => void; enabled: boolean
}) {
  const edit = useProject(state => state.editProject), drag = useRef<{ index: number; boundary: Point[] } | null>(null)
  const pending = useRef<Point[] | null>(null), [preview, setPreview] = useState<Point[] | null>(null)
  const boundary = preview || fence.boundary || fence.segments.map(segment => segment.start)
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!drag.current || !svg.current) return
      const p = pointerPlanPoint(svg.current, event)
      pending.current = drag.current.boundary.map((point, index) => index === drag.current!.index ? p : point)
      setPreview(pending.current)
    }
    const up = () => {
      if (pending.current) { const next = pending.current; edit(project => {
        const building = project.buildings.find(item => item.siteFence?.id === fence.id)
        if (building?.siteFence) building.siteFence = updateFenceBoundary(building.siteFence, next)
        return project
      }) }
      drag.current = null; pending.current = null; setPreview(null)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [svg, edit, fence.id])
  if (fence.enabled === false) return null
  return <g className="fence-plan-layer">
    <polygon points={boundary.map(p => `${p.x},${p.z}`).join(' ')} fill="none" stroke={selected ? '#46725b' : '#7b8978'} strokeWidth=".12"
      pointerEvents={enabled ? 'stroke' : 'none'} onPointerDown={event => { event.stopPropagation(); select({ kind: 'fence', id: fence.id }) }}><title>Site fence · select to edit</title></polygon>
    {enabled && selected && boundary.map((p, index) => <circle key={index} cx={p.x} cy={p.z} r=".22" fill="#fff" stroke="#46725b" strokeWidth=".06"
      onPointerDown={event => { event.stopPropagation(); drag.current = { index, boundary }; svg.current?.setPointerCapture(event.pointerId) }}>
      <title>Boundary point {index + 1} · drag to move</title>
    </circle>)}
  </g>
}
