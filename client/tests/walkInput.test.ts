import { expect, test } from 'bun:test'
import { bindWalkInput, type WalkInput } from '../src/walkthrough/input'
test('pointer capture, mouse look, WASD, interaction, release, blur, and cleanup use transient input only', async () => {
  class FakeDocument extends EventTarget { pointerLockElement: EventTarget | null = null; exitPointerLock() { this.pointerLockElement = null; this.dispatchEvent(new Event('pointerlockchange')) } }
  const documentStub = new FakeDocument(), windowStub = new EventTarget()
  class FakeCanvas extends EventTarget { denyLock = false; async requestPointerLock() { if (this.denyLock) throw new Error('Pointer capture unavailable'); documentStub.pointerLockElement = this; documentStub.dispatchEvent(new Event('pointerlockchange')) } }
  const canvas = new FakeCanvas(), previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'), previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentStub }); Object.defineProperty(globalThis, 'window', { configurable: true, value: windowStub })
  const input: WalkInput = { keys: new Set(), yaw: 0, pitch: 0, captured: false, fallback: false }
  let interactions = 0, capture = false, dragging = false
  const event = (name: string, properties: Record<string, unknown>) => Object.assign(new Event(name, { cancelable: true }), properties)
  const dispose = bindWalkInput(canvas as unknown as HTMLCanvasElement, input, (locked, fallback = false) => { capture = locked; dragging = fallback }, () => { interactions++ })
  try {
    documentStub.dispatchEvent(event('keydown', { code: 'KeyW' })); expect(input.keys.size).toBe(0)
    canvas.dispatchEvent(event('pointerdown', { button: 0 })); await Promise.resolve(); expect(capture).toBe(true)
    documentStub.dispatchEvent(event('keydown', { code: 'KeyW' })); expect(input.keys.has('KeyW')).toBe(true)
    documentStub.dispatchEvent(event('mousemove', { movementX: 10, movementY: -5, buttons: 0 })); expect(input.yaw).toBeCloseTo(-.022); expect(input.pitch).toBeCloseTo(.011)
    documentStub.dispatchEvent(event('keydown', { code: 'KeyE', repeat: false })); documentStub.dispatchEvent(event('keydown', { code: 'KeyE', repeat: true })); expect(interactions).toBe(1)
    windowStub.dispatchEvent(new Event('blur')); expect(input.keys.size).toBe(0)
    documentStub.exitPointerLock(); expect(capture).toBe(false); expect(input.captured).toBe(false)
    const yaw = input.yaw; documentStub.dispatchEvent(event('mousemove', { movementX: 10, movementY: 0, buttons: 0 })); expect(input.yaw).toBe(yaw)
    canvas.denyLock = true; canvas.dispatchEvent(event('pointerdown', { button: 0 })); await Promise.resolve()
    expect(input.fallback).toBe(true); expect(dragging).toBe(true)
    documentStub.dispatchEvent(event('mousemove', { movementX: 10, movementY: 0, buttons: 1 })); expect(input.yaw).toBeLessThan(yaw)
    documentStub.dispatchEvent(event('keydown', { code: 'KeyW' })); expect(input.keys.has('KeyW')).toBe(true)
    documentStub.dispatchEvent(event('keydown', { code: 'Escape' })); expect(input.keys.size).toBe(0); expect(input.fallback).toBe(false); expect(dragging).toBe(false)
    dispose(); canvas.dispatchEvent(event('pointerdown', { button: 0 })); await Promise.resolve(); expect(documentStub.pointerLockElement).toBeNull()
  } finally {
    dispose()
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document')
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window')
  }
})
