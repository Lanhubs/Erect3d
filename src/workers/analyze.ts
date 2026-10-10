import { preparePlan, scanDiagonals } from './opencv'
import { scanThinFeatures } from './thinFeatures'

import { scanWalls } from './wallScan'
import { outlineWalls } from './outlineWalls'
import { scanDoorSwings } from './doorSwings'
import { filterWallNetwork } from './wallNetwork'
import { scanPlanDetails } from './planDetails'
import { consolidateWalls } from './consolidateWalls'
export { scanWalls } from './wallScan'

export async function analyzePlan(pixels: Uint8ClampedArray, width: number, height: number) {
  const { structural, fine } = await preparePlan(pixels, width, height)
  const solid = scanWalls(structural, width, height, true)
  const outlines = outlineWalls(fine, outlineWalls(fine, solid, width, height), width, height)
  const candidates = filterWallNetwork(consolidateWalls([...outlines, ...await scanDiagonals(structural, width, height)]), width, height)
  const features = [...scanThinFeatures(fine, structural, width, height, candidates), ...scanDoorSwings(fine, candidates, width, height)]
  return { candidates, features, details: scanPlanDetails(fine, candidates, width, height),
    report: { width, height, smallRaster: Math.min(width, height) < 900, wallLimitReached: candidates.length >= 2400, featureLimitReached: features.length >= 6000 } }
}
export type PlanAnalysisResult = Awaited<ReturnType<typeof analyzePlan>>

if (typeof self !== 'undefined' && 'importScripts' in self) self.onmessage = (event: MessageEvent<{ pixels: Uint8ClampedArray; width: number; height: number }>) => {
  const { pixels, width, height } = event.data
  self.postMessage({ stage: 'building' })
  analyzePlan(pixels, width, height)
    .then(result => self.postMessage(result))
    .catch(cause => self.postMessage({ error: cause instanceof Error ? cause.message : 'OpenCV could not process this plan.' }))
}
