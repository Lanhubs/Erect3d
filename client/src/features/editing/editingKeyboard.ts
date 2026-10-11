import type { ElementChange } from '../../domain/elementGeometry'

export function editingKey(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>): ElementChange | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  const step = event.shiftKey ? .01 : .1, key = event.key.toLowerCase()
  return key === 'arrowleft' ? { move: { x: -step, z: 0 } }
    : key === 'arrowright' ? { move: { x: step, z: 0 } } : key === 'arrowup' ? { move: { x: 0, z: -step } }
      : key === 'arrowdown' ? { move: { x: 0, z: step } } : key === '[' ? { rotate: -5 } : key === ']' ? { rotate: 5 }
        : key === ',' ? { scale: .98 } : key === '.' ? { scale: 1.02 }
          : key === 'pageup' ? { height: step } : key === 'pagedown' ? { height: -step } : null
}
