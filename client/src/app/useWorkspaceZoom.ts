import { useEffect } from 'react'

export type ZoomDetail = { factor?: number; reset?: boolean; clientX?: number; clientY?: number }
export const zoomEvent = 'erect3d:zoom'

export function useWorkspaceZoom(view: 'plan' | 'split' | 'model') {
  useEffect(() => {
    let active: Element | null = null
    const dispatch = (detail: ZoomDetail, preferred?: Element | null) => {
      const target = preferred?.closest('.plan-editor, .viewer') ||
        document.querySelector(view === 'model' ? '.viewer' : '.plan-editor')
      target?.dispatchEvent(new CustomEvent<ZoomDetail>(zoomEvent, { detail }))
    }
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Element) active = event.target.closest('.plan-editor, .viewer') || active
    }
    const wheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !(event.target instanceof Element) || !event.target.closest('.workspace')) return
      event.preventDefault()
      if (event.target.closest('.viewer canvas')) event.stopPropagation()
      dispatch({ factor: Math.max(.6, Math.min(1.7, Math.exp(event.deltaY * (event.deltaMode ? .015 : .001)))),
        clientX: event.clientX, clientY: event.clientY }, event.target)
    }
    const key = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const plus = event.code === 'Equal' || event.code === 'NumpadAdd'
      const minus = event.code === 'Minus' || event.code === 'NumpadSubtract'
      const reset = event.code === 'Digit0' || event.code === 'Numpad0'
      if (!plus && !minus && !reset) return
      event.preventDefault()
      dispatch(reset ? { reset: true } : { factor: plus ? .8 : 1.25 }, active)
    }
    window.addEventListener('pointermove', pointer, true)
    window.addEventListener('wheel', wheel, { capture: true, passive: false })
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('pointermove', pointer, true); window.removeEventListener('wheel', wheel, true); window.removeEventListener('keydown', key, true) }
  }, [view])
}
