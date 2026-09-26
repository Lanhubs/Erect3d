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
