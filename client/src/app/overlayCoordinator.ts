type Owner = { id: symbol; close: () => void }
let active: Owner | null = null
export function activateOverlay(id: symbol, close: () => void) {
  if (active?.id === id) return
  const previous = active
  active = { id, close }
  previous?.close()
}
export function releaseOverlay(id: symbol) {
  if (active?.id !== id) return false
  active = null
  return true
}
export function closeFloatingOverlay() {
  const before = active
  active = null
  before?.close()
}
export function overlayIsActive(id: symbol) {
  return active?.id === id
}
