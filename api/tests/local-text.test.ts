import { expect, test } from 'bun:test'
import sharp from 'sharp'
import { readSourceText } from '../src/workers/source-text'
import { textTileOffsets, textDeadline } from '../src/workers/text-limits'
import { bytesHash } from '../src/modules/assets/validation'

test('bundled local OCR reads uncommon area names and retains normalized positions and original bytes', async () => {
  const svg =
    '<svg width="1000" height="500" xmlns="http://www.w3.org/2000/svg"><rect width="1000" height="500" fill="white"/><g font-family="sans-serif" font-size="38" font-weight="bold" fill="black"><text x="60" y="130">SCULLERY</text><text x="550" y="330">OBSERVATORY</text></g></svg>'
  const bytes = new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer()),
    before = bytesHash(bytes)
  const result = await readSourceText(bytes)
  expect(result.status).toBe('ready')
  const a = result.items.find((item) => item.text.includes('SCULLERY')),
    b = result.items.find((item) => item.text.includes('OBSERVATORY'))
  expect(a).toBeDefined()
  expect(b).toBeDefined()
  expect(a!.bounds.x).toBeLessThan(0.2)
  expect(b!.bounds.x).toBeGreaterThan(0.5)
  expect(bytesHash(bytes)).toBe(before)
  const cached = await readSourceText(bytes)
  cached.items[0].text = 'Changed copy'
  expect((await readSourceText(bytes)).items[0].text).not.toBe('Changed copy')
}, 20000)
test('text tiles cover the full source without accidental margin-only scans and cancellation is bounded', async () => {
  expect(textTileOffsets(1280, 1280)).toEqual([0])
  const offsets = textTileOffsets(10000, 2048)
  expect(offsets[0]).toBe(0)
  expect(offsets.at(-1)! + 2048).toBe(10000)
  expect(new Set(offsets).size).toBe(offsets.length)
  const controller = new AbortController()
  const cancelled = textDeadline(new Promise(() => {}), controller.signal)
  controller.abort(new Error('cancelled'))
  expect(cancelled).rejects.toThrow('cancelled')
})
