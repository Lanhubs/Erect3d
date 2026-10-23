import { expect, test } from 'bun:test'
import { symbolComponents, nestedSymbols } from '../src/furniture/components'
import { classifySymbol } from '../src/furniture/classification'
function symbols() {
  const width = 400,
    mask = new Uint8Array(width * 320)
  const line = (x: number, y: number, w: number, h: number) => {
    for (let a = y; a <= y + h; a++)
      for (let b = x; b <= x + w; b++)
        if (a === y || a === y + h || b === x || b === x + w) mask[a * width + b] = 1
  }
  return {
    mask,
    width,
    line,
    classify: () => {
      const components = nestedSymbols(symbolComponents(mask, width, 320))
      return components.map((c) => classifySymbol(c, width, 0.025, components))
    },
  }
}
test('sofa seat dividers are distinguished from a bed pillow band', () => {
  const image = symbols()
  image.line(50, 50, 80, 32)
  image.line(50, 56, 80, 0)
  image.line(77, 56, 0, 26)
  image.line(104, 56, 0, 26)
  expect(image.classify()[0].type).toBe('sofa')
})
test('dining table classification requires surrounding chairs rather than a bare rectangle', () => {
  const image = symbols()
  image.line(100, 80, 52, 36)
  expect(image.classify()[0].type).toBe('unknown')
  image.line(110, 50, 16, 16)
  image.line(110, 130, 16, 16)
  image.line(70, 88, 16, 16)
  image.line(167, 88, 16, 16)
  expect(image.classify().some((c) => c.type === 'dining-table')).toBe(true)
})
test('nested burner symbols classify a cooker, while an unlabeled appliance box stays unknown', () => {
  const image = symbols()
  image.line(50, 50, 28, 28)
  expect(image.classify()[0].type).toBe('unknown')
  for (const x of [54, 67]) for (const y of [54, 67]) image.line(x, y, 5, 5)
  expect(image.classify()[0].type).toBe('cooker')
})
