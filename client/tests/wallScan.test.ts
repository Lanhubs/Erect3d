import { expect, test } from 'bun:test'
import { scanWalls } from '../src/workers/analyze'

const width = 120, height = 120
function image(bands: Array<[number, number]>) {
  const dark = new Uint8Array(width * height)
  for (const [top, bottom] of bands) for (let y = top; y <= bottom; y++)
    for (let x = 10; x <= 109; x++) dark[y * width + x] = 1
  return dark
}
function horizontal(dark: Uint8Array) {
  return scanWalls(dark, width, height).filter(line => line.y1 === line.y2 && line.x2 - line.x1 >= 90)
}

test('one thick dark wall becomes one centered wall with its measured thickness', () => {
  const detected = scanWalls(image([[50, 65]]), width, height)
  const walls = detected.filter(line => line.y1 === line.y2 && line.x2 - line.x1 >= 90)
  expect(detected).toHaveLength(1)
  expect(walls).toHaveLength(1)
  expect(walls[0].y1).toBe(57.5)
  expect(walls[0].thicknessPixels).toBe(16)
})

test('separate parallel dark walls remain separate', () => {
  const walls = horizontal(image([[40, 47], [65, 72]]))
  expect(walls).toHaveLength(2)
  expect(walls.map(wall => wall.y1).sort((a, b) => a - b)).toEqual([43.5, 68.5])
})

test('dense roof hatching does not become a block of wall candidates', () => {
  const dark = image([[75, 83]])
  for (let y = 12; y <= 51; y += 3) for (let x = 10; x <= 109; x++) dark[y * width + x] = 1
  const walls = horizontal(dark)
  expect(walls).toHaveLength(1)
  expect(walls[0].y1).toBe(79)
})

test('solid exterior edge next to hatching remains a wall', () => {
  const dark = image([[54, 63]])
  for (let y = 12; y <= 51; y += 3) for (let x = 10; x <= 109; x++) dark[y * width + x] = 1
  const walls = horizontal(dark)
  expect(walls).toHaveLength(1)
  expect(walls[0].thicknessPixels).toBe(10)
})

test('a stray page border above a building does not enlarge its structural footprint', () => {
  const dark = new Uint8Array(width * height)
  for (let y = 1; y <= 3; y++) for (let x = 2; x < 118; x++) dark[y * width + x] = 1
  for (let y = 48; y <= 110; y++) for (let x = 12; x <= 106; x++) {
    if (y <= 51 || y >= 107 || x <= 15 || x >= 103 || y >= 77 && y <= 80) dark[y * width + x] = 1
  }
  const walls = scanWalls(dark, width, height)
  expect(walls.length).toBeGreaterThanOrEqual(4)
  expect(Math.min(...walls.map(wall => Math.min(wall.y1, wall.y2)))).toBeGreaterThanOrEqual(48)
})
