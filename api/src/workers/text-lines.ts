import type { Block } from 'tesseract.js'
import type { SourceLabel } from '../contracts/source-text'

export function textLines(blocks: Block[] | null, width: number, height: number): SourceLabel[] {
  const rows = (blocks || []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines))
  return rows.flatMap((line) => {
    const text = line.text
      .normalize('NFKC')
      .replace(/[|_={}<>!]+/g, ' ')
      .replaceAll('[', ' ')
      .replaceAll(']', ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.#'’]+$/gu, '')
    const numberTag =
      /^[\p{L}]?\d{1,6}[\p{L}]?$/u.test(text) &&
      line.confidence >= 70 &&
      (line.bbox.x1 - line.bbox.x0) / Math.max(1, line.bbox.y1 - line.bbox.y0) >= 0.2
    if (
      line.confidence < 35 ||
      text.length > 200 ||
      (!numberTag && !/[\p{L}]{3}|[A-Z]\.[A-Z]|^[A-Z]{2}(?:\b|\.)/u.test(text))
    )
      return []
    // Dimensions and drawing captions are useful source data too; don't restrict
    // this inventory to a whitelist of familiar room names.
    const b = line.bbox,
      x = Math.max(0, b.x0 / width),
      y = Math.max(0, b.y0 / height)
    return [
      {
        id: 'pending',
        text,
        confidence: line.confidence / 100,
        bounds: {
          x,
          y,
          width: Math.min(1 - x, Math.max(1, b.x1 - b.x0) / width),
          height: Math.min(1 - y, Math.max(1, b.y1 - b.y0) / height),
        },
      },
    ]
  })
}
export function combineTextLines(lines: SourceLabel[]) {
  const unique: SourceLabel[] = []
  for (const line of lines.toSorted((a, b) => b.confidence - a.confidence)) {
    const centre = (p: SourceLabel) => ({
      x: p.bounds.x + p.bounds.width / 2,
      y: p.bounds.y + p.bounds.height / 2,
    })
    const p = centre(line)
    if (
      unique.some((prior) => {
        const q = centre(prior)
        return (
          Math.abs(p.x - q.x) < Math.max(line.bounds.width, prior.bounds.width) / 2 &&
          Math.abs(p.y - q.y) < Math.max(line.bounds.height, prior.bounds.height) / 2
        )
      })
    )
      continue
    unique.push(line)
  }
  return unique
    .toSorted((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x)
    .map((line, index) => ({ ...line, id: `source_text_${index}` }))
}
