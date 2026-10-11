import { describe, expect, test } from 'bun:test'
import { pngSize, validateImageSize } from '../src/features/import/imageSize'

describe('large source plans', () => {
  test('reads PNG dimensions without expanding the image', async () => {
    const header = new Uint8Array(24)
    header.set([137, 80, 78, 71, 13, 10, 26, 10], 0)
    header.set([73, 72, 68, 82], 12)
    const view = new DataView(header.buffer)
    view.setUint32(16, 20_000); view.setUint32(20, 10_000)
    expect(await pngSize(new Blob([header]))).toEqual({ width: 20_000, height: 10_000 })
  })

  test('allows a long image while bounding the total pixel count', () => {
    expect(() => validateImageSize({ width: 20_000, height: 10_000 })).not.toThrow()
    expect(() => validateImageSize({ width: 20_000, height: 20_000 })).toThrow('256 MP')
  })

  test('allows a small plan to be calibrated and traced', () => {
    expect(() => validateImageSize({ width: 205, height: 180 })).not.toThrow()
    expect(() => validateImageSize({ width: 0, height: 180 })).toThrow('invalid image dimensions')
  })
})
