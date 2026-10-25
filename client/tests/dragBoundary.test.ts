import { expect, test } from 'bun:test'
import { bindDragBoundary } from '../src/features/editing/dragBoundary'

const pointer = (type: string, properties: Record<string, unknown> = {}) =>
  Object.assign(new Event(type), {
    pointerId: 7,
    pointerType: 'mouse',
    clientX: 50,
    clientY: 50,
    buttons: 1,
    ...properties,
  })

function fixture() {
  const host = new EventTarget()
  class Surface extends EventTarget {
    style = { cursor: '' }
    ownerDocument = { defaultView: host }
    captured = true
    getBoundingClientRect() {
      return { left: 0, right: 100, top: 0, bottom: 100 }
    }
    hasPointerCapture(id: number) {
      return id === 7 && this.captured
    }
    releasePointerCapture() {
      this.captured = false
      this.dispatchEvent(pointer('lostpointercapture'))
    }
  }
  return { host, surface: new Surface() }
}

test('leaving the canvas releases capture and finishes once without accepting further movement', () => {
  const { host, surface } = fixture()
  let finished = 0,
    cancelled = 0
  const cleanup = bindDragBoundary(
    surface as unknown as SVGSVGElement,
    7,
    () => finished++,
    () => cancelled++,
  )
  host.dispatchEvent(pointer('pointermove', { pointerId: 8, clientX: 150 }))
  expect(finished).toBe(0)
  host.dispatchEvent(pointer('pointermove', { clientX: 150 }))
  expect(finished).toBe(1)
  expect(cancelled).toBe(0)
  expect(surface.captured).toBe(false)
  expect(surface.style.cursor).toBe('')
  surface.dispatchEvent(pointer('pointerleave'))
  host.dispatchEvent(pointer('pointermove', { clientY: 150 }))
  host.dispatchEvent(new Event('blur'))
  cleanup()
  expect(finished).toBe(1)
  expect(cancelled).toBe(0)
})

test('blur cancels the pending edit and touch gestures are not ended by mouse-exit rules', () => {
  const { host, surface } = fixture()
  let finished = 0,
    cancelled = 0
  const cleanup = bindDragBoundary(
    surface as unknown as SVGSVGElement,
    7,
    () => finished++,
    () => cancelled++,
  )
  host.dispatchEvent(pointer('pointermove', { pointerType: 'touch', clientX: 150 }))
  surface.dispatchEvent(pointer('pointerleave', { pointerType: 'touch' }))
  expect(finished).toBe(0)
  host.dispatchEvent(new Event('blur'))
  expect(cancelled).toBe(1)
  expect(surface.captured).toBe(false)
  cleanup()
  expect(cancelled).toBe(1)
})
