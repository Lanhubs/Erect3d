export type QualityMode = 'auto' | 'performance' | 'balanced' | 'high'
export type QualityTier = Exclude<QualityMode, 'auto'>
export const qualityProfiles = {
  performance: { minDpr: 0.65, maxDpr: 1, shadowSize: 512, memoryMB: 128, detailScale: 0.75 },
  balanced: { minDpr: 0.8, maxDpr: 1.5, shadowSize: 1024, memoryMB: 256, detailScale: 1 },
  high: { minDpr: 1, maxDpr: 2, shadowSize: 2048, memoryMB: 512, detailScale: 1.4 },
} as const
export function nextResolution(dpr: number, frameMS: number, memoryMB: number, tier: QualityTier) {
  const profile = qualityProfiles[tier]
  const pressure = memoryMB > profile.memoryMB
  const change = pressure || frameMS > 24 ? -0.1 : frameMS < 18 ? 0.05 : 0
  return Math.round(Math.max(profile.minDpr, Math.min(profile.maxDpr, dpr + change)) * 100) / 100
}
