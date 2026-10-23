import type { WindowUnit, Wall } from './types'
export type WindowConstruction = {
  frameWidth?: number
  frameDepth?: number
  frameOffset?: number
  mullions?: number
  transoms?: number
  sillProjection?: number
}
export function windowConstruction(window: WindowUnit, wall: Wall) {
  const frameWidth = window.frameWidth ?? Math.min(0.055, window.width / 6, window.height / 6)
  return {
    frameWidth,
    frameDepth: window.frameDepth ?? Math.min(0.09, wall.thickness),
    frameOffset: window.frameOffset ?? 0,
    mullions: window.mullions ?? (window.type === 'fixed' ? 0 : 1),
    transoms: window.transoms ?? 0,
    sillProjection: window.sillProjection ?? 0.065,
  }
}
export function windowConstructionIssue(window: WindowUnit, wall: Wall) {
  const p = windowConstruction(window, wall),
    bar = Math.min(p.frameWidth, 0.045)
  if (Object.values(p).some((n) => !Number.isFinite(n)))
    return 'Window construction dimensions must be finite.'
  if (p.frameWidth <= 0 || p.frameDepth <= 0 || p.sillProjection < 0)
    return 'Window sections must be positive.'
  if ([p.mullions, p.transoms].some((n) => !Number.isInteger(n) || n < 0 || n > 12))
    return 'Window divisions must be whole numbers between 0 and 12.'
  const minimum = Math.min(0.03, window.width * 0.1, window.height * 0.1)
  if (
    (window.width - 2 * p.frameWidth - p.mullions * bar) / (p.mullions + 1) < minimum ||
    (window.height - 2 * p.frameWidth - p.transoms * bar) / (p.transoms + 1) < minimum
  )
    return 'The frame and divisions leave no clear glazing.'
  if (Math.abs(p.frameOffset) + p.frameDepth / 2 > wall.thickness / 2 + 0.05)
    return 'The frame must remain seated in its wall reveal.'
  return null
}
