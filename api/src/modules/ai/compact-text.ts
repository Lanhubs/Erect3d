import type { SourceText } from '../../contracts/source-text'
export function compactSourceText(source?: SourceText) {
  if (!source) return undefined
  return {
    status: source.status,
    warnings: source.warnings,
    items: source.items.map(({ id, text, confidence, bounds: b }) => [
      id,
      text,
      confidence,
      ...[b.x, b.y, b.width, b.height].map((number) => Number(number.toFixed(6))),
    ]),
  }
}
