import type { Level, Ramp, Wall } from '../../domain/types'
import { materialColor } from '../../rendering/materials'

/** A wall cannot be shortened past the last opening it hosts. */
export function minimumWallLength(wall: Wall, level: Level) {
  return Math.max(
    0.1,
    ...[...level.doors, ...level.windows, ...(level.passages || [])]
      .filter((item) => item.wallId === wall.id)
      .map((item) => item.offset + item.width + 0.05),
  )
}

export const rampRun = (ramp: Ramp) => Math.hypot(ramp.end.x - ramp.start.x, ramp.end.z - ramp.start.z)

/** The grade readout keeps the panel's long-standing radians-times-100 convention. */
export const rampSlope = (ramp: Ramp) =>
  Math.atan2(ramp.endElevation - ramp.startElevation, rampRun(ramp)) * 100

export const wallKind = (wall: Wall) => wall.kind || (wall.thickness >= 0.25 ? 'exterior' : 'interior')

export const wallPaint = (wall: Wall) => wall.color || materialColor[wall.material]

export const curveDegrees = (radians: number) => Number(((radians * 180) / Math.PI).toFixed(1))

export const curveRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Seat rows and seats per row always describe at least one occupied seat. */
export const seatingCount = (value: number) => Math.max(1, Math.round(value))

export const seatingStep = (value: number) => Math.max(0.05, value)

/** A fan section may widen by at most five metres per row. */
export const fanGrowth = (value: number) => Math.max(0, Math.min(5, value))
