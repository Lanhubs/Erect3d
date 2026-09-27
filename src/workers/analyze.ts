import { preparePlan } from './opencv'
import { scanThinFeatures } from './thinFeatures'

type Candidate = { x1: number; y1: number; x2: number; y2: number; thicknessPixels: number }
function excludeIsolatedMarks(lines: Candidate[], width: number, height: number) {
  if (lines.length < 5) return lines
  const reach = Math.max(10, Math.min(width, height) * .06)
  const nearby = (a: Candidate, b: Candidate) => {
    const dx = Math.max(0, Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2)) - Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2)))
    const dy = Math.max(0, Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2)) - Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2)))
    return Math.hypot(dx, dy) <= reach
  }
  return lines.filter((line, index) => lines.some((other, otherIndex) => index !== otherIndex && nearby(line, other)))
}
function hatchLines(lines: Candidate[], dark: Uint8Array, width: number, height: number) {
  const groups = new Map<string, Candidate[]>()
  const quantum = Math.max(8, Math.round(Math.min(width, height) * .04))
  for (const line of lines) {
    const horizontal = line.y1 === line.y2
    const start = horizontal ? line.x1 : line.y1, end = horizontal ? line.x2 : line.y2
    const key = `${horizontal ? 'h' : 'v'}:${Math.round(start / quantum)}:${Math.round(end / quantum)}`
    const group = groups.get(key)
    if (group) group.push(line); else groups.set(key, [line])
  }
  const rejected = new Set<Candidate>()
  for (const all of groups.values()) {
    const horizontal = all[0].y1 === all[0].y2
    const ordered = all.sort((a, b) => (horizontal ? a.y1 - b.y1 : a.x1 - b.x1))
    const clusters: Candidate[][] = []
    for (const line of ordered) {
      const last = clusters.at(-1), previous = last?.at(-1)
      if (previous && (horizontal ? line.y1 - previous.y1 : line.x1 - previous.x1) <= Math.max(6, Math.min(width, height) * .03)) last!.push(line)
      else clusters.push([line])
    }
    for (const group of clusters) {
    if (group.length < 6) continue
    const fixed = group.map(line => horizontal ? line.y1 : line.x1)
    const low = Math.min(...fixed), high = Math.max(...fixed)
    if (high - low < Math.min(width, height) * .06) continue
    const middle = Math.round(group.reduce((sum, line) => sum + (horizontal ? line.x1 + line.x2 : line.y1 + line.y2) / 2, 0) / group.length)
    let runs = 0, inside = false
    for (let position = low; position <= high; position++) {
      const black = Boolean(horizontal ? dark[position * width + middle] : dark[middle * width + position])
      if (black && !inside) runs++
      inside = black
    }
    if (runs >= 5) {
      const stroke = (line: Candidate) => {
        const fixed = horizontal ? line.y1 : line.x1
        let low = fixed, high = fixed
        while (low > 0 && (horizontal ? dark[(low - 1) * width + middle] : dark[middle * width + low - 1])) low--
        while (high < (horizontal ? height : width) - 1 && (horizontal ? dark[(high + 1) * width + middle] : dark[middle * width + high + 1])) high++
        return high - low + 1
      }
      const widest = Math.max(...group.map(stroke))
      for (const line of group) if (widest < 5 || stroke(line) < widest * .65) rejected.add(line)
    }
    }
  }
  return rejected
}
export function scanWalls(dark: Uint8Array, width: number, height: number) {
  const minRun = Math.max(12, Math.round(Math.min(width, height) * .035))
  const parallelGap = Math.max(4, Math.round(Math.min(width, height) * .012))
  const maxStroke = Math.max(16, Math.round(Math.min(width, height) * .08))
  const minStroke = Math.max(2, Math.round(Math.min(width, height) * .003))
  const candidates: Candidate[] = []
  for (let y = 0; y < height; y += 3) {
    let start = -1
    for (let x = 0; x <= width; x++) {
      const black = x < width && dark[y * width + x]
      if (black && start < 0) start = x
      if (!black && start >= 0) { if (x - start >= minRun) candidates.push({ x1: start, y1: y, x2: x, y2: y, thicknessPixels: 0 }); start = -1 }
    }
  }
  for (let x = 0; x < width; x += 3) {
    let start = -1
    for (let y = 0; y <= height; y++) {
      const black = y < height && dark[y * width + x]
      if (black && start < 0) start = y
      if (!black && start >= 0) { if (y - start >= minRun) candidates.push({ x1: x, y1: start, x2: x, y2: y, thicknessPixels: 0 }); start = -1 }
    }
  }
  const rejected = hatchLines(candidates, dark, width, height)
  const result: Candidate[] = []
  for (const item of candidates.sort((a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))) {
    if (rejected.has(item)) continue
    if (result.length >= 180) break
    const horizontal = item.y1 === item.y2
    const samples = [.25, .5, .75].map(t => {
        const x = Math.round(item.x1 + (item.x2 - item.x1) * t)
        const y = Math.round(item.y1 + (item.y2 - item.y1) * t)
        let negative = 0, positive = 0
        while (negative < maxStroke && (horizontal ? y - negative >= 0 && dark[(y - negative) * width + x] : x - negative >= 0 && dark[y * width + x - negative])) negative++
        while (positive < maxStroke && (horizontal ? y + positive < height && dark[(y + positive) * width + x] : x + positive < width && dark[y * width + x + positive])) positive++
        return { thickness: negative + positive - 1, center: (positive - negative) / 2 }
      })
    item.thicknessPixels = Math.min(...samples.map(sample => sample.thickness))
    if (item.thicknessPixels < minStroke) continue
    const shift = samples.map(sample => sample.center).sort((a, b) => a - b)[1]
    if (horizontal) item.y1 = item.y2 = item.y1 + shift
    else item.x1 = item.x2 = item.x1 + shift
    const embedded = result.some(other => {
      if (horizontal === (other.y1 === other.y2)) return false
      const fixed = horizontal ? item.y1 : item.x1
      const acrossStart = horizontal ? item.x1 : item.y1
      const acrossEnd = horizontal ? item.x2 : item.y2
      const otherFixed = horizontal ? other.y1 : other.x1
      const otherEnd = horizontal ? other.y2 : other.x2
      const otherCenter = horizontal ? other.x1 : other.y1
      return fixed >= otherFixed && fixed <= otherEnd &&
        acrossStart >= otherCenter - other.thicknessPixels / 2 - 1 &&
        acrossEnd <= otherCenter + other.thicknessPixels / 2 + 1
    })
    if (embedded) continue
    const duplicate = result.some(other => horizontal === (other.y1 === other.y2) &&
      (horizontal ? Math.abs(item.y1 - other.y1) <= Math.min(parallelGap, (item.thicknessPixels + other.thicknessPixels) / 2 + 2) && Math.max(item.x1, other.x1) < Math.min(item.x2, other.x2) - minRun / 2 :
        Math.abs(item.x1 - other.x1) <= Math.min(parallelGap, (item.thicknessPixels + other.thicknessPixels) / 2 + 2) && Math.max(item.y1, other.y1) < Math.min(item.y2, other.y2) - minRun / 2))
    if (!duplicate) result.push(item)
  }
  return excludeIsolatedMarks(result, width, height)
}

async function analyze(pixels: Uint8ClampedArray, width: number, height: number) {
  const { structural, fine } = await preparePlan(pixels, width, height)
  self.postMessage({ stage: 'building' })
  return { candidates: scanWalls(structural, width, height), features: scanThinFeatures(fine, structural, width, height) }
}

if (typeof self !== 'undefined') self.onmessage = (event: MessageEvent<{ pixels: Uint8ClampedArray; width: number; height: number }>) => {
  const { pixels, width, height } = event.data
  analyze(pixels, width, height)
    .then(result => self.postMessage(result))
    .catch(cause => self.postMessage({ error: cause instanceof Error ? cause.message : 'OpenCV could not process this plan.' }))
}
