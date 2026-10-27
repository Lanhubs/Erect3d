import { expect, test } from 'bun:test'
import type { Block } from 'tesseract.js'
import { combineTextLines, textLines } from '../src/workers/text-lines'
test('OCR evidence retains numbered areas and unfamiliar names without treating tall line strokes as room labels', () => {
  const line = (text: string, y: number, confidence = 92, width = 60, height = 14) => ({
    text,
    confidence,
    bbox: { x0: 20, y0: y, x1: 20 + width, y1: y + height },
  })
  const blocks = [
    {
      paragraphs: [
        {
          lines: [
            line('101', 10),
            line('A102', 35),
            line('Orangerie', 60),
            line('W.I.C.', 85),
            line('1', 110, 92, 2, 40),
            line('???', 170, 20),
          ],
        },
      ],
    },
  ] as unknown as Block[]
  const labels = combineTextLines(textLines(blocks, 300, 300))
  expect(labels.map((label) => label.text)).toEqual(['101', 'A102', 'Orangerie', 'W.I.C.'])
  expect(new Set(labels.map((label) => label.id)).size).toBe(4)
  expect(labels[0].bounds.x).toBeCloseTo(20 / 300)
})
