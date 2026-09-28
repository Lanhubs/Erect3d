import { activeLevel, type Calibration, type Project, type SourceDocument } from './types'

export function setLevelCalibration(project: Project, levelId: string, calibration: Calibration): Project {
  const copy = structuredClone(project)
  const level = activeLevel(copy, levelId)
  level.calibration = calibration
  if (level === copy.buildings[0].levels[0]) copy.calibration = calibration
  copy.modified = Date.now()
  return copy
}

export function reusedGroundCalibration(project: Project, source: SourceDocument): Calibration | undefined {
  const ground = project.buildings[0].levels[0].calibration || project.calibration
  if (!ground) return undefined
  return { a: { x: 0, z: 0 }, b: { x: source.width, z: 0 },
    knownMetres: source.width * ground.metresPerPixel, metresPerPixel: ground.metresPerPixel,
    method: 'manual', basisPixels: source.width }
}
