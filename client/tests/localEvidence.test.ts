import { expect, test } from 'bun:test'
import { publishLocalEvidence, useLocalEvidence } from '../src/cloud/localEvidence'
test('OpenCV evidence uses original-image coordinates even with a nonzero calibration origin', () => {
  const calibration = { a: { x: 100, z: 50 }, b: { x: 200, z: 50 }, knownMetres: 1, metresPerPixel: .01 }
  publishLocalEvidence('source_test', { width: 1000, height: 800 }, calibration,
    [{ id: 'wall_test', start: { x: 0, z: 0 }, end: { x: 4, z: 0 }, thickness: .2, height: 3, material: 'plaster' }], [], [])
  const wall = useLocalEvidence.getState().evidence!.candidates[0]
  expect(wall.points).toEqual([{ x: .1, y: .0625 }, { x: .5, y: .0625 }])
  expect(wall.thickness).toBe(.02)
  expect(wall.needsReview).toBe(true)
})
