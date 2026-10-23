import type { Calibration, Level, Point } from '../domain/types'
import { sourceToWorld, worldToSource, wallSubpath } from '../geometry/math'
import { symbolComponents, nestedSymbols } from './components'
import { classifySymbol } from './classification'
import { estimatedVariant, furnitureDimensions, furnitureIssues } from './entities'
import type { FurnitureCandidate } from './types'
export type FurnitureJob = {
  pixels: Uint8ClampedArray
  width: number
  height: number
  sourceWidth: number
  calibration: Calibration
  level: Level
  levels: Level[]
  sourceId: string
}
export function detectFurniture(job: FurnitureJob): FurnitureCandidate[] {
  const { pixels, width, height, calibration, level } = job,
    ratio = width / job.sourceWidth
  const metresPerPixel = calibration.metresPerPixel / ratio,
    mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) {
    const a = pixels[i * 4 + 3] / 255
    mask[i] =
      (pixels[i * 4] * 0.299 + pixels[i * 4 + 1] * 0.587 + pixels[i * 4 + 2] * 0.114) * a + 255 * (1 - a) <
      145
        ? 1
        : 0
  }
  const toPixel = (p: Point) => {
    const q = worldToSource(
      { x: p.x - (level.alignment?.x || 0), z: p.z - (level.alignment?.z || 0) },
      calibration,
    )
    return { x: q.x * ratio, z: q.z * ratio }
  }
  const erase = (a: Point, b: Point, reach: number) => {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      steps = Math.max(1, Math.ceil(Math.hypot(dx, dz))),
      radius = Math.min(80, reach)
    for (let i = 0; i <= steps; i++) {
      const cx = a.x + (dx * i) / steps,
        cy = a.z + (dz * i) / steps
      for (
        let y = Math.max(0, Math.floor(cy - radius));
        y <= Math.min(height - 1, Math.ceil(cy + radius));
        y++
      )
        for (
          let x = Math.max(0, Math.floor(cx - radius));
          x <= Math.min(width - 1, Math.ceil(cx + radius));
          x++
        )
          if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) mask[y * width + x] = 0
    }
  }
  // Structure is only masked in this copy. Accepted wall and opening arrays are never changed.
  for (const wall of level.walls) {
    const path = wallSubpath(wall, 0, undefined, 0.3).map(toPixel)
    for (let i = 1; i < path.length; i++)
      erase(path[i - 1], path[i], Math.max(2, wall.thickness / metresPerPixel / 2 + 2))
  }
  for (const guide of level.stairGuides || []) {
    const p = guide.polygon.map(toPixel),
      xs = p.map((q) => q.x),
      zs = p.map((q) => q.z)
    for (
      let y = Math.max(0, Math.floor(Math.min(...zs)));
      y < Math.min(height, Math.ceil(Math.max(...zs)));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(Math.min(...xs)));
        x < Math.min(width, Math.ceil(Math.max(...xs)));
        x++
      )
        mask[y * width + x] = 0
  }
  const components = nestedSymbols(
    symbolComponents(mask, width, height).filter((c) => Math.max(c.width, c.height) * metresPerPixel <= 3.5),
  ).filter(
    (c) =>
      Math.min(c.width, c.height) * metresPerPixel >= 0.28 &&
      Math.max(c.width, c.height) * metresPerPixel <= 3.5 &&
      c.count / (c.width * c.height) < 0.65,
  )
  return components
    .slice(0, 250)
    .map((c) => {
      const { type, confidence, rotation } = classifySymbol(c, width, metresPerPixel, components)
      const [, , objectHeight] = furnitureDimensions(type)
      const p = sourceToWorld(
        { x: (c.x + c.width / 2) / ratio, z: (c.y + c.height / 2) / ratio },
        calibration,
      )
      const turned = Math.abs(rotation) === 90
      const object: FurnitureCandidate = {
        id: `furniture:${job.sourceId}:${c.x}:${c.y}:${c.width}:${c.height}`,
        type,
        levelId: level.id,
        position: { x: p.x + (level.alignment?.x || 0), z: p.z + (level.alignment?.z || 0) },
        rotation,
        width: (turned ? c.height : c.width) * metresPerPixel,
        depth: (turned ? c.width : c.height) * metresPerPixel,
        height: objectHeight,
        assetId: 'standard',
        confidence,
        status: 'uncertain',
        issues: [],
        sourceBounds: { x: c.x / ratio, y: c.y / ratio, width: c.width / ratio, height: c.height / ratio },
      }
      object.assetId = estimatedVariant(type, object.width)
      Object.assign(object, furnitureIssues(object, level, job.levels))
      return object
    })
    .filter((c) => c.type !== 'unknown' || !c.issues.includes('Outside a complete room or floor footprint'))
}
