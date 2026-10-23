export type WalkInput = {
  keys: Set<string>
  yaw: number
  pitch: number
  captured: boolean
  fallback: boolean
}
export function bindWalkInput(
  canvas: HTMLCanvasElement,
  input: WalkInput,
  capture: (value: boolean, dragging?: boolean) => void,
  interact: () => void,
) {
  let disposed = false
  const clear = () => input.keys.clear()
  const down = (event: KeyboardEvent) => {
    if (
      (event.target as HTMLElement)?.closest?.('input,textarea,select,button,[contenteditable=true]') ||
      (!input.captured && !input.fallback)
    )
      return
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ShiftLeft',
        'ShiftRight',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(event.code)
    ) {
      event.preventDefault()
      input.keys.add(event.code)
    }
    if (event.code === 'KeyE' && !event.repeat) {
      event.preventDefault()
      interact()
    }
    if (event.code === 'Escape' && input.fallback) {
      input.fallback = false
      clear()
      capture(false)
    }
  }
  const up = (event: KeyboardEvent) => input.keys.delete(event.code)
  const mouse = (event: MouseEvent) => {
    if (!input.captured && !(input.fallback && event.buttons & 1)) return
    input.yaw -= event.movementX * 0.0022
    input.pitch = Math.max(-1.45, Math.min(1.45, input.pitch - event.movementY * 0.0022))
  }
  const lock = () => {
    input.captured = document.pointerLockElement === canvas
    input.fallback = false
    clear()
    capture(input.captured)
  }
  const click = async (event: PointerEvent) => {
    if (event.button !== 0 || input.captured) return
    try {
      await canvas.requestPointerLock()
      if (disposed) {
        if (document.pointerLockElement === canvas) document.exitPointerLock()
        return
      }
      input.captured = document.pointerLockElement === canvas
      capture(input.captured)
    } catch {
      if (!disposed) {
        input.fallback = true
        capture(false, true)
      }
    }
  }
  document.addEventListener('keydown', down)
  document.addEventListener('keyup', up)
  document.addEventListener('mousemove', mouse)
  document.addEventListener('pointerlockchange', lock)
  window.addEventListener('blur', clear)
  canvas.addEventListener('pointerdown', click)
  return () => {
    disposed = true
    clear()
    document.removeEventListener('keydown', down)
    document.removeEventListener('keyup', up)
    document.removeEventListener('mousemove', mouse)
    document.removeEventListener('pointerlockchange', lock)
    window.removeEventListener('blur', clear)
    canvas.removeEventListener('pointerdown', click)
    if (document.pointerLockElement === canvas) document.exitPointerLock()
    input.captured = false
    input.fallback = false
  }
}
