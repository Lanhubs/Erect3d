// Minimal ASCII DXF writer so test fixtures stay readable and never hand-count group codes.
export type Group = [number, string | number]
export const groups = (items: Group[]): string[] => items.flatMap(([code, value]) => [`${code}`, `${value}`])
export const entity = (type: string, items: Group[]): string[] => ['0', type, ...groups(items)]
export const section = (name: string, lines: string[]): string[] => [
  '0',
  'SECTION',
  '2',
  name,
  ...lines,
  '0',
  'ENDSEC',
]
export const table = (name: string, rows: string[][]): string[] => [
  '0',
  'TABLE',
  '2',
  name,
  ...rows.flat(),
  '0',
  'ENDTAB',
]
export const dxfDocument = (sections: string[][]) => [...sections.flat(), '0', 'EOF'].join('\n') + '\n'
