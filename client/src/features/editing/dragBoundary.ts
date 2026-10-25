/** Release an edit at the canvas edge; preserve the selected entity and its last valid position. */
export function bindDragBoundary(
  surface: SVGSVGElement | HTMLCanvasElement,
  pointerId: number,
  finish: () => void,
  cancel: () => void,
) {
  const host = surface.ownerDocument.defaultView || window
  let closed = false
  const cleanup = () => {
    if (closed) return
    closed = true
    host.removeEventListener('pointermove', move, true)
    host.removeEventListener('blur', blur)
    surface.removeEventListener('pointerleave', leave)
    surface.removeEventListener('lostpointercapture', lost)
    surface.style.cursor = ''
    if (surface.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId)
  }
  const stop = () => {
    if (closed) return
    cleanup()
    finish()
  }
  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointerId || event.pointerType === 'touch') return
    const bounds = surface.getBoundingClientRect()
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom ||
      event.buttons === 0
    )
      stop()
  }
  const leave = (raw: Event) => {
    const event = raw as PointerEvent
    if (event.pointerId === pointerId && event.pointerType !== 'touch') stop()
  }
  const lost = (raw: Event) => {
    const event = raw as PointerEvent
    if (event.pointerId === pointerId) stop()
  }
  const blur = () => {
    if (closed) return
    cleanup()
    cancel()
  }
  surface.style.cursor = 'grabbing'
  host.addEventListener('pointermove', move, true)
  host.addEventListener('blur', blur)
  surface.addEventListener('pointerleave', leave)
  surface.addEventListener('lostpointercapture', lost)
  return cleanup
}
